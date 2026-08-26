import { useEffect, useState } from 'react'
import type { Periodo } from '../types'

export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setLoading(true); setData(null)
    fn().then(d => { setData(d); setLoading(false) })
       .catch(e => { setError(String(e)); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, loading, error }
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
