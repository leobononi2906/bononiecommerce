import { supabase } from '../lib/supabase'
import { useQuery, getCanal, buscarTudo } from '../lib/query'

export type Canal = 'vendedor' | 'site' | 'marketplace'

export interface VendedorDim {
  id_vendedor: number
  nome: string        // nome normalizado (trim)
  canal: Canal
}

export interface VendaDoc {
  tipo_doc: string
  id_doc: number
  id_empresa: number
  id_vendedor: number
  num_nf: string | null
  num_nf_origem?: 'erp' | 'bling'
  data_faturamento: string
  fat: number
}

/** Nota fiscal de marketplace via `chave_nfe`, batendo com `exp_documentos` (Expedição) — o ERP
 *  não grava `num_nf` pra esse canal (achado em 17/09/2026: 0 de ~1.000 docs em jun/jul), mas
 *  também só carrega `chave_nfe` em ~24% dos documentos, então isso preenche uma fração, não tudo.
 *  `exp_documentos` vem de uma integração direta com o Bling (Edge Function `exp-sync-bling` do
 *  app Expedição, mesmo projeto Supabase) — não tem `id_doc`, então o único elo confiável é a
 *  chave de acesso da NFe. Casar por cliente+data+valor foi descartado: é a mesma heurística que
 *  já gerou 17 chaves duplicadas dentro do próprio exp-sync-bling.
 *  Ver docs/STATUS.md (17/09/2026) e `bononi-exped/docs/INTEGRACAO_BLING.md`. */
async function numNfPorChave(chaves: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  const validas = [...new Set(chaves.filter(Boolean))]
  if (!validas.length) return m
  const LOTE = 300
  for (let i = 0; i < validas.length; i += LOTE) {
    const lote = validas.slice(i, i + LOTE)
    const { data } = await supabase
      .from('exp_documentos')
      .select('chave_nfe,num_nf')
      .eq('canal', 'MARKETPLACE')
      .in('chave_nfe', lote)
    ;(data || []).forEach((r: any) => { if (r.chave_nfe && r.num_nf) m.set(r.chave_nfe, r.num_nf) })
  }
  return m
}

/** Histórico de vendas a nível de DOCUMENTO (não de item) — uma linha por nota, não por produto
 *  dentro dela. Para a tela "Histórico de vendas" (filtro canal/vendedor sem quebrar por produto). */
export function useDocsFaturados(start: string, end: string, enabled: boolean) {
  return useQuery<VendaDoc[]>(async () => {
    if (!enabled || !start || !end) return []
    const rows = await buscarTudo<any>((de, ate) => supabase
      .from('vw_comercial_docs_margem')
      .select('id,tipo_doc,id_doc,id_empresa,id_vendedor,num_nf,chave_nfe,data_faturamento,faturamento_doc')
      .eq('tipo_saida', 'ONLINE')
      .gte('data_faturamento', start)
      .lte('data_faturamento', end)
      .order('id', { ascending: true })
      .range(de, ate))
    const semNf = rows.filter((r: any) => !r.num_nf && r.chave_nfe)
    const porChave = await numNfPorChave(semNf.map((r: any) => r.chave_nfe))
    return rows.map((r: any) => {
      const doBling = !r.num_nf && r.chave_nfe ? porChave.get(r.chave_nfe) : undefined
      return {
        tipo_doc: r.tipo_doc, id_doc: r.id_doc, id_empresa: r.id_empresa, id_vendedor: r.id_vendedor,
        num_nf: r.num_nf || doBling || null,
        num_nf_origem: r.num_nf ? 'erp' : doBling ? 'bling' : undefined,
        data_faturamento: r.data_faturamento, fat: Number(r.faturamento_doc) || 0,
      }
    })
  }, [start, end, enabled])
}

export interface RelItemRaw {
  id_vendedor: number
  referencia: string
  produto: string
  grupo: string
  subgrupo: string
  mes: string   // 'yyyy-mm'
  id_doc: number
  qtd: number
  fat: number
}

/** Lookup id_vendedor → nome + canal, a partir dos docs ONLINE do período (humanos, marketplace e site). */
export function useVendedoresDim(start: string, end: string, enabled: boolean) {
  return useQuery<VendedorDim[]>(async () => {
    if (!enabled || !start || !end) return []
    const data = await buscarTudo<any>((de, ate) => supabase
      .from('vw_comercial_docs_faturados')
      .select('id,id_vendedor,nome_vendedor')
      .eq('tipo_saida', 'ONLINE')
      .gte('data_faturamento', start)
      .lte('data_faturamento', end)
      .order('id', { ascending: true })
      .range(de, ate))
    const map = new Map<number, VendedorDim>()
    data.forEach((r: any) => {
      if (r.id_vendedor == null || map.has(r.id_vendedor)) return
      const nome = (r.nome_vendedor || '').trim()
      map.set(r.id_vendedor, { id_vendedor: r.id_vendedor, nome, canal: getCanal(nome) })
    })
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome))
  }, [start, end, enabled])
}

/** Itens faturados ONLINE no intervalo [start, end]. Esta tela já paginava à mão desde antes;
 *  agora usa o mesmo `buscarTudo` do resto do app (páginas de 5.000 em vez de 1.000). */
export function useRelatorioItens(start: string, end: string, enabled: boolean) {
  return useQuery<RelItemRaw[]>(async () => {
    if (!enabled || !start || !end) return []
    const rows = await buscarTudo<any>((de, ate) => supabase
      .from('vw_comercial_itens_faturados')
      .select('id,id_vendedor,referencia,produto,grupo,subgrupo,data_faturamento,id_doc,qtd,total_item')
      .eq('tipo_saida', 'ONLINE')
      .gte('data_faturamento', start)
      .lte('data_faturamento', end)
      .order('id', { ascending: true })
      .range(de, ate))
    const all: RelItemRaw[] = rows.map((r: any) => ({
      id_vendedor: r.id_vendedor,
      referencia: r.referencia || '—',
      produto: r.produto || '—',
      grupo: r.grupo || '—',
      subgrupo: r.subgrupo || '—',
      mes: (r.data_faturamento || '').slice(0, 7),
      id_doc: r.id_doc,
      qtd: Number(r.qtd) || 0,
      fat: Number(r.total_item) || 0,
    }))
    return all
  }, [start, end, enabled])
}
