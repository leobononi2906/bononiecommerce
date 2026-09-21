import { useCallback, useEffect, useState } from 'react'
import type { Periodo } from '../types'

export interface QueryState<T> {
  data: T | null
  loading: boolean
  /** Mensagem legível quando a carga falhou. Quem mostra número PRECISA ler isto:
   *  com `data` nulo toda agregação dá 0, e 0 na tela se lê como fato. */
  error: string | null
  /** Refaz a busca (botão "tentar de novo" do aviso de falha). */
  reload: () => void
}

/** Erros que a tentativa seguinte costuma vencer. As views pesadas (`vw_ecom_tempo_resposta`,
 *  `vw_ecom_campanha_conversao`, `vw_ecom_subgrupos`) estouram o statement_timeout de 8s na
 *  primeira chamada com cache frio e respondem na segunda — e quem abre um dashboard de gestão
 *  é justamente quem pega a chamada fria. Erro de schema/sintaxe não passa nunca: repetir só
 *  atrasaria a mensagem. */
function valeRepetir(e: any): boolean {
  const code = String(e?.code ?? '')
  if (code === '57014' || code === '57P01' || code === '08006') return true
  return e instanceof TypeError   // fetch que não completou (rede/DNS)
}

const ESPERA_MS = [400, 1200]

export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const reload = useCallback(() => setTentativa(t => t + 1), [])

  useEffect(() => {
    let cancelado = false
    setLoading(true); setData(null); setError(null)

    ;(async () => {
      for (let i = 0; ; i++) {
        try {
          const d = await fn()
          if (cancelado) return
          setData(d); setError(null); setLoading(false)
          return
        } catch (e: any) {
          if (cancelado) return
          if (i < ESPERA_MS.length && valeRepetir(e)) {
            await new Promise(r => setTimeout(r, ESPERA_MS[i]))
            if (cancelado) return
            continue
          }
          setError(e?.message ? String(e.message) : String(e))
          setLoading(false)
          return
        }
      }
    })()

    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tentativa])

  return { data, loading, error, reload }
}

/** Linhas por requisição. Medido em 16/09/2026 contra os 21.727 leads de 6 meses:
 *  1.000 → 22 req / 14.450 ms · 2.000 → 11 req / 8.966 ms · 5.000 → 5 req / 5.462 ms.
 *  Paginar re-executa a consulta inteira a cada página (o PostgREST vira LIMIT/OFFSET),
 *  então página pequena é cara. 5.000 tem folga de 2x sobre o `db_max_rows` de 10.000
 *  configurado nos dois projetos — e `buscarTudo` funciona mesmo se esse teto mudar. */
const PAGINA = 5000

/** Teto de sanidade: 50 requisições (250 mil linhas, sondagens de fim inclusas). Se bater aqui,
 *  o filtro está errado — melhor estourar alto e visível do que devolver meio resultado calado. */
const MAX_REQUISICOES = 50

/**
 * Busca TODAS as linhas de uma consulta, em páginas.
 *
 * Substitui o `.range(0, 9999)` que estava espalhado pelos hooks. Aquilo **não era paginação,
 * era um teto**: passando de 10.000 linhas o PostgREST corta e responde 200, sem erro e sem
 * aviso, com o número menor que a realidade. Em 16/09/2026 isso já acontecia de verdade —
 * `ecom_leads` em "últimos 6 meses" tem 21.727 linhas e o app recebia 10.000, perdendo 11.727.
 *
 * `paginar` recebe o intervalo e devolve a consulta já montada. **Ela precisa terminar com um
 * `.order()` por chave estável** (`id` onde existir): sem ordenação o Postgres não garante a
 * mesma ordem entre chamadas, e aí a paginação repete uma linha e pula outra — que é um jeito
 * pior de errar do que truncar.
 *
 * O avanço é pelo que a resposta REALMENTE trouxe, não por `página × tamanho`. Assim, se o
 * servidor tiver um teto por requisição menor que `PAGINA` (o projeto de teste já esteve com
 * 1.000), a busca continua correta em vez de parar achando que acabou.
 *
 * Uma página mais curta que `PAGINA` (inclusive vazia) só é aceita como fim depois de uma
 * SONDAGEM de 1 linha bem no ponto onde a busca parou. Achado em 21/09/2026: sob carga
 * concorrente (duas sessões batendo no mesmo Supabase de produção), a MESMA consulta trouxe
 * 566 linhas, depois 1129, antes do valor real de 7066 — o Supabase/PostgREST truncou a página
 * sob contenção, sem erro nenhum (`data` não-nulo, só menos linha que o pedido). Sem a
 * sondagem, "página curta" e "acabaram os dados" eram a mesma coisa; com ela, achar a linha
 * seguinte prova que a página anterior foi truncada — em vez de perder o resto, ela entra no
 * total e a busca volta a paginar normalmente a partir dali. Ver docs/STATUS.md (21/09/2026).
 */
export async function buscarTudo<T>(
  paginar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const tudo: T[] = []
  let de = 0
  let requisicoes = 0

  while (requisicoes < MAX_REQUISICOES) {
    requisicoes++
    const { data, error } = await paginar(de, de + PAGINA - 1)
    if (error) throw error
    const lote = data ?? []
    tudo.push(...lote)
    de += lote.length

    if (lote.length === PAGINA) continue   // página cheia: pode ter mais, segue paginando

    // Página curta ou vazia — sonda 1 linha no ponto exato onde paramos antes de confiar que
    // acabou. Achar linha aqui prova truncamento: junta a linha sondada e deixa o laço de fora
    // buscar a próxima página normalmente a partir dela, em vez de perder o resto calado.
    if (requisicoes >= MAX_REQUISICOES) break
    requisicoes++
    const sonda = await paginar(de, de)
    if (sonda.error) throw sonda.error
    const linhaSonda = sonda.data ?? []
    if (!linhaSonda.length) return tudo
    tudo.push(...linhaSonda)
    de += linhaSonda.length
  }
  throw new Error(
    `buscarTudo: passou de ${MAX_REQUISICOES} requisições (${tudo.length} linhas). ` +
    `O filtro da consulta provavelmente está amplo demais.`,
  )
}

export function getPeriodRange(periodo: Periodo): { start: string; end: string } {
  if (typeof periodo === 'object') return { start: periodo.inicio, end: periodo.fim }
  const now = new Date(), y = now.getFullYear(), m = now.getMonth()
  if (periodo === 'mes_atual')    return { start: new Date(y,m,1).toISOString().slice(0,10),   end: new Date(y,m+1,0).toISOString().slice(0,10) }
  if (periodo === 'mes_anterior') return { start: new Date(y,m-1,1).toISOString().slice(0,10), end: new Date(y,m,0).toISOString().slice(0,10) }
  if (periodo === '3_meses')      return { start: new Date(y,m-2,1).toISOString().slice(0,10), end: new Date(y,m+1,0).toISOString().slice(0,10) }
  return { start: new Date(y,m-5,1).toISOString().slice(0,10), end: new Date(y,m+1,0).toISOString().slice(0,10) }
}

/** Período anterior de um recorte personalizado: mesma duração, terminando no dia anterior ao
 *  início. 01–15/09 (15 dias) vira 17–31/08 — comparação "vs anterior" com base equivalente. */
function periodoAnteriorEquivalente(inicio: string, fim: string): { start: string; end: string } {
  const dias = Math.round((Date.parse(fim + 'T12:00:00') - Date.parse(inicio + 'T12:00:00')) / 86400000) + 1
  const fimAnt = new Date(inicio + 'T12:00:00'); fimAnt.setDate(fimAnt.getDate() - 1)
  const inicioAnt = new Date(fimAnt); inicioAnt.setDate(inicioAnt.getDate() - dias + 1)
  return { start: inicioAnt.toISOString().slice(0,10), end: fimAnt.toISOString().slice(0,10) }
}

export function getPreviousPeriodRange(periodo: Periodo): { start: string; end: string } {
  if (typeof periodo === 'object') return periodoAnteriorEquivalente(periodo.inicio, periodo.fim)
  const now = new Date(), y = now.getFullYear(), m = now.getMonth()
  if (periodo === 'mes_atual')    return { start: new Date(y,m-1,1).toISOString().slice(0,10), end: new Date(y,m,0).toISOString().slice(0,10) }
  if (periodo === 'mes_anterior') return { start: new Date(y,m-2,1).toISOString().slice(0,10), end: new Date(y,m-1,0).toISOString().slice(0,10) }
  if (periodo === '3_meses')      return { start: new Date(y,m-5,1).toISOString().slice(0,10), end: new Date(y,m-2,0).toISOString().slice(0,10) }
  return { start: new Date(y,m-11,1).toISOString().slice(0,10), end: new Date(y,m-5,0).toISOString().slice(0,10) }
}

const ROTULO_FIXO: Record<'mes_atual'|'mes_anterior'|'3_meses'|'6_meses', string> = {
  mes_atual: 'Mês atual', mes_anterior: 'Mês anterior', '3_meses': 'Últimos 3 meses', '6_meses': 'Últimos 6 meses',
}
const ROTULO_ANT_FIXO: Record<'mes_atual'|'mes_anterior'|'3_meses'|'6_meses', string> = {
  mes_atual: 'mês anterior', mes_anterior: 'mês retrasado', '3_meses': '3 meses anteriores', '6_meses': '6 meses anteriores',
}
function fmtCurta(iso: string): string { return iso.slice(8,10) + '/' + iso.slice(5,7) }

/** Rótulo do período pra exibir na tela — mesmo texto nos 4 lugares que hoje repetiam o Record
 *  (AppShell, Marketplace, CampanhasRoi), agora um só, que também sabe formatar o personalizado. */
export function periodoLabel(periodo: Periodo): string {
  if (typeof periodo === 'object') return `${fmtCurta(periodo.inicio)}–${fmtCurta(periodo.fim)}`
  return ROTULO_FIXO[periodo]
}
export function periodoLabelAnterior(periodo: Periodo): string {
  if (typeof periodo === 'object') {
    const ant = periodoAnteriorEquivalente(periodo.inicio, periodo.fim)
    return `${fmtCurta(ant.start)}–${fmtCurta(ant.end)}`
  }
  return ROTULO_ANT_FIXO[periodo]
}

function addDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Quais dos últimos 2 dias corridos (hoje e ontem) têm pedido represado esperando faturamento.
 *
 * Achado em 17/09/2026, com dado real: pedido contado pela data de CRIAÇÃO (`vw_ecom_docs_datas`)
 * só aparece como faturado depois que o ERP processa a nota — e isso não acontece no mesmo dia.
 * Marketplace foi de ~40 pedidos/dia (08–16/09) para **4** em 17/09 — não é queda de venda, é
 * atraso de faturamento. Sem este aviso, os últimos 1-2 dias do período parecem uma queda real.
 *
 * `datasCriacao` é a lista de `data_criacao` de TODOS os documentos do canal no período (não só
 * hoje/ontem) — a função usa os dias anteriores como base de comparação. Só avalia se o período
 * selecionado alcança hoje (período fechado no passado não precisa deste aviso) e só acusa atraso
 * se houver pelo menos 5 dias "maduros" pra comparar — sem base, fica calado em vez de arriscar.
 */
export function diasComPedidoRepresado(datasCriacao: string[], fimPeriodo: string): string[] {
  const hoje = new Date().toISOString().slice(0, 10)
  if (fimPeriodo < hoje) return []
  const porDia = new Map<string, number>()
  datasCriacao.forEach(d => porDia.set(d, (porDia.get(d) || 0) + 1))
  const ontem = addDias(hoje, -1)
  const candidatos = [ontem, hoje].filter(d => d <= fimPeriodo)
  const maduros = [...porDia.keys()].filter(d => d < ontem).sort().slice(-7)
  if (maduros.length < 5) return []
  const media = maduros.reduce((s, d) => s + porDia.get(d)!, 0) / maduros.length
  return candidatos.filter(d => (porDia.get(d) || 0) < media * 0.5)
}

export const MKT_NAMES = new Set(['ML BATTOGO', 'ML BONONI FULL', 'ML BONONI', 'SHOPEE BRASIL'])
// 'SITE' = plataforma antiga (zerou jun-jul/26); 'TRAY' = Tray Commerce, a loja virtual atual (migração abr-jul/26).
// Ambos representam o MESMO canal de negócio (loja virtual própria) em épocas diferentes.
export const SITE_NAMES = new Set(['SITE', 'TRAY'])

export function getCanal(nome: string): 'marketplace' | 'site' | 'vendedor' {
  const n = nome.trim().toUpperCase()
  if (MKT_NAMES.has(n) || n.startsWith('ML ') || n === 'SHOPEE BRASIL') return 'marketplace'
  if (SITE_NAMES.has(n)) return 'site'
  return 'vendedor'
}
