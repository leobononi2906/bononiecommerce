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

export function getPeriodRange(periodo: Periodo): { start: string; end: string } {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth()
  if (periodo === 'mes_atual')    return { start: new Date(y,m,1).toISOString().slice(0,10),   end: new Date(y,m+1,0).toISOString().slice(0,10) }
  if (periodo === 'mes_anterior') return { start: new Date(y,m-1,1).toISOString().slice(0,10), end: new Date(y,m,0).toISOString().slice(0,10) }
  if (periodo === '3_meses')      return { start: new Date(y,m-2,1).toISOString().slice(0,10), end: new Date(y,m+1,0).toISOString().slice(0,10) }
  return { start: new Date(y,m-5,1).toISOString().slice(0,10), end: new Date(y,m+1,0).toISOString().slice(0,10) }
}

export function getPreviousPeriodRange(periodo: Periodo): { start: string; end: string } {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth()
  if (periodo === 'mes_atual')    return { start: new Date(y,m-1,1).toISOString().slice(0,10), end: new Date(y,m,0).toISOString().slice(0,10) }
  if (periodo === 'mes_anterior') return { start: new Date(y,m-2,1).toISOString().slice(0,10), end: new Date(y,m-1,0).toISOString().slice(0,10) }
  if (periodo === '3_meses')      return { start: new Date(y,m-5,1).toISOString().slice(0,10), end: new Date(y,m-2,0).toISOString().slice(0,10) }
  return { start: new Date(y,m-11,1).toISOString().slice(0,10), end: new Date(y,m-5,0).toISOString().slice(0,10) }
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
