import { supabase } from '../lib/supabase'
import { useQuery, getPeriodRange, getPreviousPeriodRange } from '../lib/query'
import type { Periodo } from '../types'

// Devolução EXTERNA (interna=false) amarrada à venda ONLINE de origem.
// Grão = item devolvido. `nome_vendedor` é o da VENDA de origem → o front aplica
// o MESMO getCanal do faturamento (marketplace/site/vendedor), sem duplicar lógica.
// Atribuição temporal = data_devolucao (mês em que a devolução ocorreu / competência do retorno).
// Fonte: public.vw_ecom_devolucao_externa (ver docs/ESTADO_ATUAL_APP.md).
const DEV_COLS = 'nome_vendedor,valor_total,data_devolucao'

async function fetchDevolucao(start: string, end: string) {
  const { data, error } = await supabase
    .from('vw_ecom_devolucao_externa')
    .select(DEV_COLS)
    .gte('data_devolucao', start)
    .lte('data_devolucao', end)
    .range(0, 9999)
  if (error) throw error
  return data || []
}

export function useDevolucaoPeriodo(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<any[]>(() => fetchDevolucao(start, end), [start, end])
}

/** Mesmo recorte, período imediatamente anterior — para o comparativo dos cards. */
export function useDevolucaoPeriodoAnterior(periodo: Periodo) {
  const { start, end } = getPreviousPeriodRange(periodo)
  return useQuery<any[]>(() => fetchDevolucao(start, end), [start, end])
}

export function useDevolucao6Meses() {
  return useQuery<any[]>(async () => {
    const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1)
    const { data, error } = await supabase
      .from('vw_ecom_devolucao_externa')
      .select(DEV_COLS)
      .gte('data_devolucao', d.toISOString().slice(0, 10))
      .range(0, 9999)
    if (error) throw error
    return data || []
  }, [])
}

// Mesma fonte, com id_vendedor (para agregar por vendedor individual — página Vendedores)
const DEV_VEND_COLS = 'id_vendedor,nome_vendedor,valor_total,data_devolucao'

async function fetchDevolucaoPorVendedor(start: string, end: string) {
  const { data, error } = await supabase
    .from('vw_ecom_devolucao_externa')
    .select(DEV_VEND_COLS)
    .gte('data_devolucao', start)
    .lte('data_devolucao', end)
    .range(0, 9999)
  if (error) throw error
  return data || []
}

export function useDevolucaoPorVendedorPeriodo(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<any[]>(() => fetchDevolucaoPorVendedor(start, end), [start, end])
}

// Item-level, para a página Relatórios (mesmos filtros de grupo/subgrupo/produto/vendedor das vendas).
export interface DevItemRaw {
  id_vendedor: number
  referencia: string
  produto: string
  grupo: string
  subgrupo: string
  mes: string   // 'yyyy-mm', derivado de data_devolucao
  qtd: number
  fat: number   // valor_total da devolução (positivo)
}

export function useDevolucaoItens(start: string, end: string, enabled: boolean) {
  return useQuery<DevItemRaw[]>(async () => {
    if (!enabled || !start || !end) return []
    const { data, error } = await supabase
      .from('vw_ecom_devolucao_externa')
      .select('id_vendedor,referencia,nome_produto,grupo,subgrupo,data_devolucao,qtd,valor_total')
      .gte('data_devolucao', start)
      .lte('data_devolucao', end)
      .range(0, 9999)
    if (error) throw error
    return (data || []).map((r: any) => ({
      id_vendedor: r.id_vendedor,
      referencia: r.referencia || '—',
      produto: r.nome_produto || '—',
      grupo: r.grupo || '—',
      subgrupo: r.subgrupo || '—',
      mes: (r.data_devolucao || '').slice(0, 7),
      qtd: Number(r.qtd) || 0,
      fat: Number(r.valor_total) || 0,
    }))
  }, [start, end, enabled])
}
