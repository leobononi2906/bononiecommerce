import { supabase } from '../lib/supabase'
import { useQuery, getPeriodRange, getPreviousPeriodRange, getCanal, buscarTudo } from '../lib/query'
import { comDataDePedido } from './use-faturamento'
import type { EcomSubgrupo, Periodo } from '../types'

// ── Marketplace: desempenho por canal (ML, Shopee…) ───────────────
export interface MktCanal {
  nome: string
  fatBrutoAtual: number; fatBrutoAnt: number   // antes da devolução externa
  fatAtual: number; pedidosAtual: number; ticketAtual: number
  fatAnt: number; pedidosAnt: number
  deltaRs: number; deltaPct: number | null
  devAtual: number   // devolução externa abatida no período (faturamento já é líquido)
}

/** Normaliza o nome do canal (tira espaços duplos/pontas, uppercase). */
export function normMkt(nome: string): string {
  return (nome || '').trim().replace(/\s+/g, ' ').toUpperCase()
}

// Faturamento por canal de marketplace, contado pela DATA DO PEDIDO (não pela data de
// faturamento) — achado em 17/09/2026: o ERP fatura o marketplace em lote, e 726 dos 1.360
// docs de setembro/26 eram na verdade pedido de abril a agosto (lote de 229 caiu de uma vez em
// 11/09). Mesma mecânica e mesma correção já aplicada ao canal Site (ver `use-faturamento.ts`).
// Recebe os ids do canal (de `useMktCanais`) para não ter que baixar TODO o histórico ONLINE
// (site+vendedor+marketplace) só para filtrar marketplace em memória depois.
async function fetchMktComDataDePedido(ids: number[], start: string, end: string) {
  if (!ids.length) return []
  const docs = await buscarTudo<any>((de, ate) => supabase
    .from('vw_comercial_docs_margem')
    .select('id,tipo_doc,id_doc,id_empresa,nome_vendedor,faturamento_doc')
    .eq('tipo_saida', 'ONLINE')
    .in('id_vendedor', ids)
    .order('id', { ascending: true })
    .range(de, ate))
  return comDataDePedido(docs, start, end)
}

async function aggMktPorPedido(ids: number[], start: string, end: string) {
  const m = new Map<string, { fat: number; ped: number }>()
  const comData = await fetchMktComDataDePedido(ids, start, end)
  comData.forEach((r: any) => {
    const k = normMkt(r.nome_vendedor)
    const c = m.get(k) || { fat: 0, ped: 0 }
    c.fat += Number(r.faturamento_doc) || 0
    c.ped++
    m.set(k, c)
  })
  return { agg: m, datas: comData.map((r: any) => r.data_criacao as string) }
}

// Devolução externa por canal de marketplace (mesma classificação normMkt do faturamento).
// nome_vendedor = vendedor da VENDA de origem; atribuição temporal = data_devolucao.
async function aggMktDev(start: string, end: string) {
  const data = await buscarTudo<any>((de, ate) => supabase
    .from('vw_ecom_devolucao_externa')
    .select('id,nome_vendedor,valor_total,data_devolucao')
    .gte('data_devolucao', start)
    .lte('data_devolucao', end)
    .order('id', { ascending: true })
    .range(de, ate))
  const m = new Map<string, number>()
  data.forEach((r: any) => {
    if (getCanal(r.nome_vendedor || '') !== 'marketplace') return
    const k = normMkt(r.nome_vendedor)
    m.set(k, (m.get(k) || 0) + (Number(r.valor_total) || 0))
  })
  return m
}

/** Faturamento por canal no período + comparativo com o período anterior, pela data do pedido.
 *  `ids` vem de `useMktCanais()` — sem eles (ainda carregando) devolve vazio, não zero-como-fato,
 *  porque quem chama já protege com o `loading` combinado. */
export function useMarketplaceCanais(periodo: Periodo, ids: number[] | null) {
  const cur = getPeriodRange(periodo)
  const prev = getPreviousPeriodRange(periodo)
  const chaveIds = (ids || []).join(',')
  return useQuery<{ canais: MktCanal[]; totalAtual: number; totalAnt: number; totalBrutoAtual: number; totalBrutoAnt: number; datasCriacao: string[] }>(async () => {
    const idsOk = ids || []
    const [ra, rb, da, db] = await Promise.all([
      aggMktPorPedido(idsOk, cur.start, cur.end), aggMktPorPedido(idsOk, prev.start, prev.end),
      aggMktDev(cur.start, cur.end), aggMktDev(prev.start, prev.end),
    ])
    const a = ra.agg, b = rb.agg
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
        fatBrutoAtual: at.fat, fatBrutoAnt: an.fat,
        fatAtual, pedidosAtual: at.ped, ticketAtual: at.ped > 0 ? fatAtual / at.ped : 0,
        fatAnt, pedidosAnt: an.ped,
        deltaRs, deltaPct,
        devAtual: da.get(nome) || 0,
      }
    }).sort((x, y) => y.fatAtual - x.fatAtual)
    const totalAtual = canais.reduce((s, c) => s + c.fatAtual, 0)
    const totalAnt = canais.reduce((s, c) => s + c.fatAnt, 0)
    const totalBrutoAtual = canais.reduce((s, c) => s + c.fatBrutoAtual, 0)
    const totalBrutoAnt = canais.reduce((s, c) => s + c.fatBrutoAnt, 0)
    return { canais, totalAtual, totalAnt, totalBrutoAtual, totalBrutoAnt, datasCriacao: ra.datas }
  }, [chaveIds, cur.start, cur.end, prev.start, prev.end])
}

/** Marketplace, últimos 6 meses, pela DATA DO PEDIDO — mesmo critério do card "período
 *  selecionado" (`useMarketplaceCanais` acima), para a tabela "Por departamento" bater com
 *  os cards em vez de comparar NF emitida (atrasada) com pedido feito. Devolve as linhas
 *  cruas (uma por documento, com `data_criacao`) para o chamador bucketizar por mês — achado
 *  em 21/09/2026, mesma causa do site. Ver docs/STATUS.md. */
export function useMarketplace6MesesPorPedido(ids: number[] | null) {
  const { start, end } = getPeriodRange('6_meses')
  const chaveIds = (ids || []).join(',')
  return useQuery<any[]>(async () => {
    const idsOk = ids || []
    if (!idsOk.length) return []
    return fetchMktComDataDePedido(idsOk, start, end)
  }, [chaveIds, start, end])
}

export interface MktCanalId { id: number; label: string }

/** Rótulo curto de exibição. Só encurta o que já era apelido conhecido — canal novo aparece
 *  com o nome que tem no ERP, em vez de sumir da tela. */
const APELIDO: Record<string, string> = {
  'ML BATTOGO': 'ML Battogo',
  'ML BONONI': 'ML Bononi',
  'ML BONONI FULL': 'ML Full',
  'SHOPEE BRASIL': 'Shopee',
}
export function rotuloCanal(nome: string): string {
  const n = normMkt(nome)
  // Palavra de até 3 letras fica em caixa alta: são siglas (ML, MLB, PR, SC) e capitalizá-las
  // produz "ML Mlb PR". Só o que é palavra mesmo vira Capitalizada.
  return APELIDO[n] ?? n.replace(/\b\w+/g, p => p.length > 3 ? p[0] + p.slice(1).toLowerCase() : p)
}

/**
 * Canais de marketplace com o id_vendedor do ERP — DESCOBERTOS a partir do faturamento, não
 * escritos à mão. A view de itens só traz `id_vendedor`, mas a de documentos traz id + nome,
 * então o canal é classificado pelo mesmo `getCanal()` do resto do app.
 *
 * Era uma lista fixa de 4 ids. Quando o ERP passou a faturar por 'ML MLB PR' (id 88661, R$ 108k
 * em set/26) o canal aparecia no total por canal e **sumia** da tabela por produto — a mesma
 * tela não fechava consigo mesma, e nada no código acusava.
 */
export function useMktCanais() {
  return useQuery<MktCanalId[]>(async () => {
    const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1)
    const data = await buscarTudo<any>((de, ate) => supabase
      .from('vw_comercial_docs_faturados')
      .select('id,id_vendedor,nome_vendedor')
      .eq('tipo_saida', 'ONLINE')
      .gte('data_faturamento', d.toISOString().slice(0, 10))
      .order('id', { ascending: true })
      .range(de, ate))
    const porId = new Map<number, string>()
    data.forEach((r: any) => {
      if (getCanal(r.nome_vendedor || '') !== 'marketplace') return
      if (r.id_vendedor != null) porId.set(Number(r.id_vendedor), r.nome_vendedor)
    })
    return [...porId.entries()]
      .map(([id, nome]) => ({ id, label: rotuloCanal(nome) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [])
}

export interface MktProdutoRow {
  canalId: number
  referencia: string
  produto: string
  mes: string   // 'yyyy-mm'
  qtd: number
  fat: number
}

/** Itens faturados por produto/mês nos canais de marketplace (últimos 6 meses).
 *  Recebe os ids descobertos por `useMktCanais` — nunca uma lista escrita à mão. */
export function useMarketplaceProdutos6Meses(ids: number[] | null) {
  const chave = (ids || []).join(',')
  return useQuery<MktProdutoRow[]>(async () => {
    if (!ids || !ids.length) return []
    const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1)
    const data = await buscarTudo<any>((de, ate) => supabase
      .from('vw_comercial_itens_faturados')
      .select('id,id_vendedor,referencia,produto,data_faturamento,qtd,total_item')
      .eq('tipo_saida', 'ONLINE')
      .in('id_vendedor', ids)
      .gte('data_faturamento', d.toISOString().slice(0, 10))
      .order('id', { ascending: true })
      .range(de, ate))
    return data.map((r: any) => ({
      canalId: r.id_vendedor,
      referencia: r.referencia || '—',
      produto: r.produto || '—',
      mes: (r.data_faturamento || '').slice(0, 7),
      qtd: Number(r.qtd) || 0,
      fat: Number(r.total_item) || 0,
    }))
  }, [chave])
}

/** Devolução externa por produto/mês nos MESMOS canais de marketplace (últimos 6 meses) —
 *  mesmo `id_vendedor` do faturamento acima, pra casar por `referencia`+`mes` sem duplicar
 *  classificação de canal. Decisão do Leo em 2026-09-23: o pivô de produtos ficava bruto
 *  "de propósito", agora desconta devolução igual ao card e ao gráfico por canal. */
export function useMarketplaceDevolucaoProdutos6Meses(ids: number[] | null) {
  const chave = (ids || []).join(',')
  return useQuery<MktProdutoRow[]>(async () => {
    if (!ids || !ids.length) return []
    const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1)
    const data = await buscarTudo<any>((de, ate) => supabase
      .from('vw_ecom_devolucao_externa')
      .select('id,id_vendedor,referencia,nome_produto,data_devolucao,qtd,valor_total')
      .in('id_vendedor', ids)
      .gte('data_devolucao', d.toISOString().slice(0, 10))
      .order('id', { ascending: true })
      .range(de, ate))
    return data.map((r: any) => ({
      canalId: r.id_vendedor,
      referencia: r.referencia || '—',
      produto: r.nome_produto || '—',
      mes: (r.data_devolucao || '').slice(0, 7),
      qtd: Number(r.qtd) || 0,
      fat: Number(r.valor_total) || 0,
    }))
  }, [chave])
}

/** Série mensal (últimos 6 meses) por canal — LÍQUIDA. Devolução entra como fat negativo
 *  (data_devolucao), somando por mês×canal na mesma agregação do faturamento. */
export function useMarketplace6Meses() {
  return useQuery<{ data_faturamento: string; canal: string; fat: number }[]>(async () => {
    const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1)
    const from = d.toISOString().slice(0, 10)
    const [fatRows, devRows] = await Promise.all([
      buscarTudo<any>((de, ate) => supabase.from('vw_comercial_docs_faturados')
        .select('id,data_faturamento,nome_vendedor,faturamento_doc')
        .eq('tipo_saida', 'ONLINE').gte('data_faturamento', from)
        .order('id', { ascending: true }).range(de, ate)),
      buscarTudo<any>((de, ate) => supabase.from('vw_ecom_devolucao_externa')
        .select('id,data_devolucao,nome_vendedor,valor_total')
        .gte('data_devolucao', from)
        .order('id', { ascending: true }).range(de, ate)),
    ])
    const out: { data_faturamento: string; canal: string; fat: number }[] = []
    fatRows.forEach((r: any) => {
      if (getCanal(r.nome_vendedor || '') !== 'marketplace') return
      out.push({ data_faturamento: r.data_faturamento, canal: normMkt(r.nome_vendedor), fat: Number(r.faturamento_doc) || 0 })
    })
    devRows.forEach((r: any) => {
      if (getCanal(r.nome_vendedor || '') !== 'marketplace') return
      out.push({ data_faturamento: r.data_devolucao, canal: normMkt(r.nome_vendedor), fat: -(Number(r.valor_total) || 0) })
    })
    return out
  }, [])
}

export function useSubgrupos(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomSubgrupo[]>(async () => {
    const data = await buscarTudo<any>((de, ate) => supabase.from('vw_ecom_subgrupos')
      .select('*').gte('data_ref',start).lte('data_ref',end)
      .order('id', { ascending: true }).range(de, ate))
    return data.map(r => ({
      ...r, faturamento: Number(r.faturamento), custo_total: Number(r.custo_total), margem_total: Number(r.margem_total), margem_perc: Number(r.margem_perc), qtd_vendida: Number(r.qtd_vendida)
    }))
  }, [start, end])
}

export function useSubgruposERP() {
  return useQuery<string[]>(async () => {
    // Janela longa de propósito (é a lista de opções do filtro), então é a que mais pagina.
    const data = await buscarTudo<any>((de, ate) => supabase
      .from('vw_ecom_subgrupos')
      .select('id,subgrupo')
      .gte('data_ref', '2025-01-01')
      .order('id', { ascending: true })
      .range(de, ate))
    const set = new Set<string>(data.map((r:any) => r.subgrupo as string).filter(Boolean))
    return [...set].sort()
  }, [])
}
