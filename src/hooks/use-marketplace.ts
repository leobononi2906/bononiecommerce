import { supabase } from '../lib/supabase'
import { useQuery, getPeriodRange, getPreviousPeriodRange, getCanal } from '../lib/query'
import type { EcomSubgrupo, Periodo } from '../types'

// ── Marketplace: desempenho por canal (ML, Shopee…) ───────────────
export interface MktCanal {
  nome: string
  fatAtual: number; pedidosAtual: number; ticketAtual: number
  fatAnt: number; pedidosAnt: number
  deltaRs: number; deltaPct: number | null
}

/** Normaliza o nome do canal (tira espaços duplos/pontas, uppercase). */
export function normMkt(nome: string): string {
  return (nome || '').trim().replace(/\s+/g, ' ').toUpperCase()
}

async function aggMkt(start: string, end: string) {
  const { data, error } = await supabase
    .from('vw_comercial_docs_faturados')
    .select('nome_vendedor,faturamento_doc')
    .eq('tipo_saida', 'ONLINE')
    .gte('data_faturamento', start)
    .lte('data_faturamento', end)
    .range(0, 9999)
  if (error) throw error
  const m = new Map<string, { fat: number; ped: number }>()
  ;(data || []).forEach((r: any) => {
    if (getCanal(r.nome_vendedor || '') !== 'marketplace') return
    const k = normMkt(r.nome_vendedor)
    const c = m.get(k) || { fat: 0, ped: 0 }
    c.fat += Number(r.faturamento_doc) || 0
    c.ped++
    m.set(k, c)
  })
  return m
}

/** Faturamento por canal no período + comparativo com o período anterior. */
export function useMarketplaceCanais(periodo: Periodo) {
  const cur = getPeriodRange(periodo)
  const prev = getPreviousPeriodRange(periodo)
  return useQuery<{ canais: MktCanal[]; totalAtual: number; totalAnt: number }>(async () => {
    const [a, b] = await Promise.all([aggMkt(cur.start, cur.end), aggMkt(prev.start, prev.end)])
    const nomes = new Set<string>([...a.keys(), ...b.keys()])
    const canais: MktCanal[] = [...nomes].map(nome => {
      const at = a.get(nome) || { fat: 0, ped: 0 }
      const an = b.get(nome) || { fat: 0, ped: 0 }
      const deltaRs = at.fat - an.fat
      const deltaPct = an.fat > 0 ? (deltaRs / an.fat) * 100 : null
      return {
        nome,
        fatAtual: at.fat, pedidosAtual: at.ped, ticketAtual: at.ped > 0 ? at.fat / at.ped : 0,
        fatAnt: an.fat, pedidosAnt: an.ped,
        deltaRs, deltaPct,
      }
    }).sort((x, y) => y.fatAtual - x.fatAtual)
    const totalAtual = canais.reduce((s, c) => s + c.fatAtual, 0)
    const totalAnt = canais.reduce((s, c) => s + c.fatAnt, 0)
    return { canais, totalAtual, totalAnt }
  }, [cur.start, cur.end, prev.start, prev.end])
}

/** Série mensal (últimos 6 meses) por canal — para as sparklines de tendência. */
export function useMarketplace6Meses() {
  return useQuery<{ data_faturamento: string; canal: string; fat: number }[]>(async () => {
    const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1)
    const { data, error } = await supabase
      .from('vw_comercial_docs_faturados')
      .select('data_faturamento,nome_vendedor,faturamento_doc')
      .eq('tipo_saida', 'ONLINE')
      .gte('data_faturamento', d.toISOString().slice(0, 10))
      .range(0, 9999)
    if (error) throw error
    return (data || [])
      .filter((r: any) => getCanal(r.nome_vendedor || '') === 'marketplace')
      .map((r: any) => ({ data_faturamento: r.data_faturamento, canal: normMkt(r.nome_vendedor), fat: Number(r.faturamento_doc) || 0 }))
  }, [])
}

export function useSubgrupos(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomSubgrupo[]>(async () => {
    const { data, error } = await supabase.from('vw_ecom_subgrupos').select('*').gte('data_ref',start).lte('data_ref',end).range(0,9999)
    if (error) throw error
    return (data||[]).map(r => ({
      ...r, faturamento: Number(r.faturamento), custo_total: Number(r.custo_total), margem_total: Number(r.margem_total), margem_perc: Number(r.margem_perc), qtd_vendida: Number(r.qtd_vendida)
    }))
  }, [start, end])
}

export function useSubgruposERP() {
  return useQuery<string[]>(async () => {
    const { data, error } = await supabase
      .from('vw_ecom_subgrupos')
      .select('subgrupo')
      .gte('data_ref', '2025-01-01')
      .range(0, 9999)
    if (error) throw error
    const set = new Set<string>((data||[]).map((r:any) => r.subgrupo as string).filter(Boolean))
    return [...set].sort()
  }, [])
}
