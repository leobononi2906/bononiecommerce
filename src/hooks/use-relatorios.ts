import { supabase } from '../lib/supabase'
import { useQuery, getCanal } from '../lib/query'

export type Canal = 'vendedor' | 'site' | 'marketplace'

export interface VendedorDim {
  id_vendedor: number
  nome: string        // nome normalizado (trim)
  canal: Canal
}

export interface RelItemRaw {
  id_vendedor: number
  referencia: string
  produto: string
  id_doc: number
  qtd: number
  fat: number
}

/** Lookup id_vendedor → nome + canal, a partir dos docs ONLINE do período (humanos, marketplace e site). */
export function useVendedoresDim(start: string, end: string, enabled: boolean) {
  return useQuery<VendedorDim[]>(async () => {
    if (!enabled || !start || !end) return []
    const { data, error } = await supabase
      .from('vw_comercial_docs_faturados')
      .select('id_vendedor,nome_vendedor')
      .eq('tipo_saida', 'ONLINE')
      .gte('data_faturamento', start)
      .lte('data_faturamento', end)
      .range(0, 9999)
    if (error) throw error
    const map = new Map<number, VendedorDim>()
    ;(data || []).forEach((r: any) => {
      if (r.id_vendedor == null || map.has(r.id_vendedor)) return
      const nome = (r.nome_vendedor || '').trim()
      map.set(r.id_vendedor, { id_vendedor: r.id_vendedor, nome, canal: getCanal(nome) })
    })
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome))
  }, [start, end, enabled])
}

/** Itens faturados ONLINE no intervalo [start, end], paginado (sem limite de 1000). */
export function useRelatorioItens(start: string, end: string, enabled: boolean) {
  return useQuery<RelItemRaw[]>(async () => {
    if (!enabled || !start || !end) return []
    const PAGE = 1000
    let from = 0
    const all: RelItemRaw[] = []
    // paginação por range até vir uma página incompleta (protege contra o cap de 1000)
    // guarda de segurança em 120k linhas
    for (let i = 0; i < 120; i++) {
      const { data, error } = await supabase
        .from('vw_comercial_itens_faturados')
        .select('id_vendedor,referencia,produto,id_doc,qtd,total_item')
        .eq('tipo_saida', 'ONLINE')
        .gte('data_faturamento', start)
        .lte('data_faturamento', end)
        .order('id')
        .range(from, from + PAGE - 1)
      if (error) throw error
      const rows = data || []
      rows.forEach((r: any) => all.push({
        id_vendedor: r.id_vendedor,
        referencia: r.referencia || '—',
        produto: r.produto || '—',
        id_doc: r.id_doc,
        qtd: Number(r.qtd) || 0,
        fat: Number(r.total_item) || 0,
      }))
      if (rows.length < PAGE) break
      from += PAGE
    }
    return all
  }, [start, end, enabled])
}
