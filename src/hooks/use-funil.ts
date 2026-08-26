import { supabase } from '../lib/supabase'
import { useQuery, getPeriodRange } from '../lib/query'
import type { Periodo } from '../types'

export interface FunilLead {
  telefone: string
  dt_entrada: string
  id_membro_umbler: string | null
  tags: string[]
  comprou_erp: boolean
  valor_venda_erp: number
}

export interface ConfigEtiqueta {
  id: number
  coluna_key: string
  label: string
  padroes: string[]
  tipo_match: 'prefixo' | 'exato'
  cor: string
  conta_funil: boolean
  ordem: number
  ativo: boolean
}

/** Busca paginada — o período de 6 meses passa de 10k linhas. */
async function fetchTodos(start: string, end: string): Promise<FunilLead[]> {
  const PAGE = 5000
  const MAX_PAGES = 12
  const out: FunilLead[] = []
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await supabase
      .from('ecom_atd_funil')
      .select('telefone,dt_entrada,id_membro_umbler,tags,comprou_erp,valor_venda_erp')
      .gte('dt_entrada', start + 'T00:00:00')
      .lte('dt_entrada', end + 'T23:59:59')
      .order('dt_entrada', { ascending: true })
      .range(p * PAGE, (p + 1) * PAGE - 1)
    if (error) throw error
    const lote = (data || []) as FunilLead[]
    out.push(...lote)
    if (lote.length < PAGE) break
  }
  return out
}

export function useFunilAtendimento(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<FunilLead[]>(async () => {
    const rows = await fetchTodos(start, end)
    return rows.map(r => ({ ...r, tags: Array.isArray(r.tags) ? r.tags : [], valor_venda_erp: Number(r.valor_venda_erp) || 0 }))
  }, [start, end])
}

export function useConfigEtiquetas(refreshKey = 0) {
  return useQuery<ConfigEtiqueta[]>(async () => {
    const { data, error } = await supabase
      .from('ecom_atd_config_etiqueta')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .range(0, 999)
    if (error) throw error
    return (data || []).map((r: any) => ({
      ...r,
      padroes: Array.isArray(r.padroes) ? r.padroes : [],
    })) as ConfigEtiqueta[]
  }, [refreshKey])
}

export async function salvarPadraoEtiqueta(id: number, padrao: string) {
  const { error } = await supabase
    .from('ecom_atd_config_etiqueta')
    .update({ padroes: [padrao], atualizado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Um lead casa com a coluna se alguma etiqueta bater com algum padrão. */
export function leadCasa(tags: string[], cfg: ConfigEtiqueta): boolean {
  if (!cfg.padroes.length) return false
  return tags.some(tag => {
    const t = (tag || '').toUpperCase()
    return cfg.padroes.some(p => {
      const pd = (p || '').toUpperCase()
      if (!pd) return false
      return cfg.tipo_match === 'exato' ? t === pd : t.startsWith(pd)
    })
  })
}

/**
 * Candidatos para o seletor do cabeçalho: as etiquetas que existem de verdade
 * na base, mais os prefixos de 1 e 2 palavras (para pegar famílias como
 * "INTERESSADO" ou "EM ATENDIMENTO" sem depender do nome do vendedor).
 */
export function candidatosEtiqueta(leads: FunilLead[] | null): string[] {
  const set = new Set<string>()
  ;(leads || []).forEach(l => {
    (l.tags || []).forEach(tag => {
      const t = (tag || '').trim().toUpperCase()
      if (!t) return
      set.add(t)
      const partes = t.split(/\s+/)
      if (partes.length > 1) set.add(partes[0])
      if (partes.length > 2) set.add(partes.slice(0, 2).join(' '))
    })
  })
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
