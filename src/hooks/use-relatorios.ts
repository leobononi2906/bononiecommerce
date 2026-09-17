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
  data_faturamento: string
  fat: number
}

/** Histórico de vendas a nível de DOCUMENTO (não de item) — uma linha por nota, não por produto
 *  dentro dela. Para a tela "Histórico de vendas" (filtro canal/vendedor sem quebrar por produto). */
export function useDocsFaturados(start: string, end: string, enabled: boolean) {
  return useQuery<VendaDoc[]>(async () => {
    if (!enabled || !start || !end) return []
    const rows = await buscarTudo<any>((de, ate) => supabase
      .from('vw_comercial_docs_margem')
      .select('id,tipo_doc,id_doc,id_empresa,id_vendedor,num_nf,data_faturamento,faturamento_doc')
      .eq('tipo_saida', 'ONLINE')
      .gte('data_faturamento', start)
      .lte('data_faturamento', end)
      .order('id', { ascending: true })
      .range(de, ate))
    return rows.map((r: any) => ({
      tipo_doc: r.tipo_doc, id_doc: r.id_doc, id_empresa: r.id_empresa, id_vendedor: r.id_vendedor,
      num_nf: r.num_nf, data_faturamento: r.data_faturamento, fat: Number(r.faturamento_doc) || 0,
    }))
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
