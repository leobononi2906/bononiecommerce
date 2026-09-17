import { supabase } from '../lib/supabase'
import { useQuery, getPeriodRange, getPreviousPeriodRange, buscarTudo, SITE_NAMES } from '../lib/query'
import type { Periodo } from '../types'

// custo_doc apelidado do custo pelo PREÇO DE COMPRA (custo_doc_pc) — consumidores seguem usando r.custo_doc
// `id` entra no select porque é a chave de ordenação da paginação: sem ordem estável o Postgres
// pode repetir uma linha numa página e pular outra na seguinte.
const FAT_COLS = 'id,tipo_doc,id_doc,id_empresa,id_vendedor,nome_vendedor,faturamento_doc,custo_doc:custo_doc_pc,taxa_marketplace,faturamento_liquido,data_faturamento'

async function fetchFaturamento(start: string, end: string) {
  return buscarTudo<any>((de, ate) => supabase
    .from('vw_comercial_docs_margem')
    .select(FAT_COLS)
    .eq('tipo_saida', 'ONLINE')
    .gte('data_faturamento', start)
    .lte('data_faturamento', end)
    .order('id', { ascending: true })
    .range(de, ate))
}

export function useFaturamentoPeriodo(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<any[]>(() => fetchFaturamento(start, end), [start, end])
}

/** Mesmo recorte, mas do período imediatamente anterior — para comparativo nos cards. */
export function useFaturamentoPeriodoAnterior(periodo: Periodo) {
  const { start, end } = getPreviousPeriodRange(periodo)
  return useQuery<any[]>(() => fetchFaturamento(start, end), [start, end])
}

// Faturamento contado pela DATA DO PEDIDO, não pela data de faturamento — o ERP às vezes
// fatura em lote pedidos represados de meses antes (achado em 17/09/2026 no site: 26 pedidos
// de fev-ago faturados de uma vez em 03/09; confirmado no mesmo dia no marketplace: 726 de
// 1.360 docs de setembro eram criação de abril-agosto). A view `vw_ecom_docs_datas` (aplicada
// em 2026-09-17) traz a data de criação a nível de documento — cruzada em memória com os docs
// do canal, porque as duas views não têm uma FK que o PostgREST possa embutir.
const SITE_LIST = Array.from(SITE_NAMES)

/** Busca `vw_ecom_docs_datas` para uma lista de id_doc, em lotes — uma lista grande (o
 *  marketplace tem ~8.700 documentos históricos) estoura o tamanho de URL num `.in()` só. */
const LOTE_IDS = 400
export async function fetchDocsDatasPorIdDoc(idDocs: number[]): Promise<any[]> {
  const lotes: number[][] = []
  for (let i = 0; i < idDocs.length; i += LOTE_IDS) lotes.push(idDocs.slice(i, i + LOTE_IDS))
  const resultados = await Promise.all(lotes.map(lote => buscarTudo<any>((de, ate) => supabase
    .from('vw_ecom_docs_datas')
    .select('tipo_doc,id_doc,id_empresa,data_criacao')
    .in('id_doc', lote)
    .order('id_doc', { ascending: true })
    .range(de, ate))))
  return resultados.flat()
}

/** Cruza docs (já filtrados por canal) com a data de criação, e recorta pelo período pedido. */
export async function comDataDePedido<T extends { tipo_doc: string; id_doc: number; id_empresa: number }>(
  docs: T[], start: string, end: string,
): Promise<(T & { data_criacao: string })[]> {
  if (!docs.length) return []
  const idDocs = [...new Set(docs.map(d => d.id_doc))]
  const datas = await fetchDocsDatasPorIdDoc(idDocs)
  const porChave = new Map(datas.map((d: any) => [`${d.tipo_doc}|${d.id_doc}|${d.id_empresa}`, d.data_criacao]))
  return docs
    .map(d => ({ ...d, data_criacao: porChave.get(`${d.tipo_doc}|${d.id_doc}|${d.id_empresa}`) }))
    .filter((d): d is T & { data_criacao: string } => !!d.data_criacao && d.data_criacao >= start && d.data_criacao <= end)
}

async function fetchFaturamentoSite(start: string, end: string) {
  // O volume do canal site é pequeno (dezenas por mês), então não precisa (e não pode, sem a
  // data de criação ainda) ser filtrado por data aqui — histórico completo.
  const docs = await buscarTudo<any>((de, ate) => supabase
    .from('vw_comercial_docs_margem')
    .select(FAT_COLS)
    .eq('tipo_saida', 'ONLINE')
    .in('nome_vendedor', SITE_LIST)
    .order('id', { ascending: true })
    .range(de, ate))
  return comDataDePedido(docs, start, end)
}

export function useFaturamentoSitePeriodo(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<any[]>(() => fetchFaturamentoSite(start, end), [start, end])
}

export function useFaturamentoSitePeriodoAnterior(periodo: Periodo) {
  const { start, end } = getPreviousPeriodRange(periodo)
  return useQuery<any[]>(() => fetchFaturamentoSite(start, end), [start, end])
}

export function useFaturamento6Meses() {
  return useQuery<any[]>(async () => {
    const d = new Date(); d.setMonth(d.getMonth()-5); d.setDate(1)
    return buscarTudo<any>((de, ate) => supabase
      .from('vw_comercial_docs_faturados')
      .select('id,data_faturamento,nome_vendedor,faturamento_doc')
      .eq('tipo_saida', 'ONLINE')
      .gte('data_faturamento', d.toISOString().slice(0,10))
      .order('id', { ascending: true })
      .range(de, ate))
  }, [])
}
