import { supabase } from '../lib/supabase'
import { useQuery, getPeriodRange, getPreviousPeriodRange, getCanal } from '../lib/query'
import type { EcomSubgrupo, Periodo } from '../types'

// ── Marketplace: desempenho por canal (ML, Shopee…) ───────────────
export interface MktCanal {
  nome: string
  fatAtual: number; pedidosAtual: number; ticketAtual: number
  fatAnt: number; pedidosAnt: number
  deltaRs: number; deltaPct: number | null
  devAtual: number   // devolução externa abatida no período (faturamento já é líquido)
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

// Devolução externa por canal de marketplace (mesma classificação normMkt do faturamento).
// nome_vendedor = vendedor da VENDA de origem; atribuição temporal = data_devolucao.
async function aggMktDev(start: string, end: string) {
  const { data, error } = await supabase
    .from('vw_ecom_devolucao_externa')
    .select('nome_vendedor,valor_total,data_devolucao')
    .gte('data_devolucao', start)
    .lte('data_devolucao', end)
    .range(0, 9999)
  if (error) throw error
  const m = new Map<string, number>()
  ;(data || []).forEach((r: any) => {
    if (getCanal(r.nome_vendedor || '') !== 'marketplace') return
    const k = normMkt(r.nome_vendedor)
    m.set(k, (m.get(k) || 0) + (Number(r.valor_total) || 0))
  })
  return m
}

/** Faturamento por canal no período + comparativo com o período anterior. */
export function useMarketplaceCanais(periodo: Periodo) {
  const cur = getPeriodRange(periodo)
  const prev = getPreviousPeriodRange(periodo)
  return useQuery<{ canais: MktCanal[]; totalAtual: number; totalAnt: number }>(async () => {
    const [a, b, da, db] = await Promise.all([
      aggMkt(cur.start, cur.end), aggMkt(prev.start, prev.end),
      aggMktDev(cur.start, cur.end), aggMktDev(prev.start, prev.end),
    ])
    const nomes = new Set<string>([...a.keys(), ...b.keys(), ...da.keys(), ...db.keys()])
    const canais: MktCanal[] = [...nomes].map(nome => {
      const at = a.get(nome) || { fat: 0, ped: 0 }
      const an = b.get(nome) || { fat: 0, ped: 0 }
      // Faturamento LÍQUIDO = bruto − devolução externa do canal
      const fatAtual = at.fat - (da.get(nome) || 0)
      const fatAnt = an.fat - (db.get(nome) || 0)
      const deltaRs = fatAtual - fatAnt
      const deltaPct = fatAnt > 0 ? (deltaRs / fatAnt) * 100 : null
      return {
        nome,
        fatAtual, pedidosAtual: at.ped, ticketAtual: at.ped > 0 ? fatAtual / at.ped : 0,
        fatAnt, pedidosAnt: an.ped,
        deltaRs, deltaPct,
        devAtual: da.get(nome) || 0,
      }
    }).sort((x, y) => y.fatAtual - x.fatAtual)
    const totalAtual = canais.reduce((s, c) => s + c.fatAtual, 0)
    const totalAnt = canais.reduce((s, c) => s + c.fatAnt, 0)
    return { canais, totalAtual, totalAnt }
  }, [cur.start, cur.end, prev.start, prev.end])
}

// Canais de marketplace por id_vendedor no ERP (a view de itens só traz id).
// Mesma origem dos nomes classificados por getCanal() em vw_comercial_docs_faturados.
export const MKT_CANAIS: { id: number; label: string }[] = [
  { id: 79832, label: 'ML Battogo' },
  { id: 79830, label: 'ML Bononi' },
  { id: 79831, label: 'ML Full' },
  { id: 46961, label: 'Shopee' },
]

export interface MktProdutoRow {
  canalId: number
  referencia: string
  produto: string
  mes: string   // 'yyyy-mm'
  qtd: number
  fat: number
}

/** Itens faturados por produto/mês nos canais de marketplace (últimos 6 meses). */
export function useMarketplaceProdutos6Meses() {
  return useQuery<MktProdutoRow[]>(async () => {
    const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1)
    const ids = MKT_CANAIS.map(c => c.id)
    const { data, error } = await supabase
      .from('vw_comercial_itens_faturados')
      .select('id_vendedor,referencia,produto,data_faturamento,qtd,total_item')
      .eq('tipo_saida', 'ONLINE')
      .in('id_vendedor', ids)
      .gte('data_faturamento', d.toISOString().slice(0, 10))
      .range(0, 9999)
    if (error) throw error
    return (data || []).map((r: any) => ({
      canalId: r.id_vendedor,
      referencia: r.referencia || '—',
      produto: r.produto || '—',
      mes: (r.data_faturamento || '').slice(0, 7),
      qtd: Number(r.qtd) || 0,
      fat: Number(r.total_item) || 0,
    }))
  }, [])
}

/** Série mensal (últimos 6 meses) por canal — LÍQUIDA. Devolução entra como fat negativo
 *  (data_devolucao), somando por mês×canal na mesma agregação do faturamento. */
export function useMarketplace6Meses() {
  return useQuery<{ data_faturamento: string; canal: string; fat: number }[]>(async () => {
    const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1)
    const from = d.toISOString().slice(0, 10)
    const [fatRes, devRes] = await Promise.all([
      supabase.from('vw_comercial_docs_faturados')
        .select('data_faturamento,nome_vendedor,faturamento_doc')
        .eq('tipo_saida', 'ONLINE').gte('data_faturamento', from).range(0, 9999),
      supabase.from('vw_ecom_devolucao_externa')
        .select('data_devolucao,nome_vendedor,valor_total')
        .gte('data_devolucao', from).range(0, 9999),
    ])
    if (fatRes.error) throw fatRes.error
    if (devRes.error) throw devRes.error
    const out: { data_faturamento: string; canal: string; fat: number }[] = []
    ;(fatRes.data || []).forEach((r: any) => {
      if (getCanal(r.nome_vendedor || '') !== 'marketplace') return
      out.push({ data_faturamento: r.data_faturamento, canal: normMkt(r.nome_vendedor), fat: Number(r.faturamento_doc) || 0 })
    })
    ;(devRes.data || []).forEach((r: any) => {
      if (getCanal(r.nome_vendedor || '') !== 'marketplace') return
      out.push({ data_faturamento: r.data_devolucao, canal: normMkt(r.nome_vendedor), fat: -(Number(r.valor_total) || 0) })
    })
    return out
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
