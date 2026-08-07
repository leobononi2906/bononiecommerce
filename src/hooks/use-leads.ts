import { supabase } from '../lib/supabase'
import { useQuery, getPeriodRange } from '../lib/query'
import type { EcomOrigemLead, Periodo } from '../types'

export function useLeads(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('ecom_leads')
      .select('id,criado_em,nome_vendedor,id_vendedor,etapa,valor_venda')
      .gte('criado_em', start+'T00:00:00')
      .lte('criado_em', end+'T23:59:59')
      .range(0,9999)
    if (error) throw error
    return data || []
  }, [start, end])
}

/** Leads dos últimos N dias (padrão 30) — para o mapa de calor de horário de chegada. */
export function useLeadsRecentes(dias = 30) {
  return useQuery<{ criado_em: string }[]>(async () => {
    const desde = new Date()
    desde.setDate(desde.getDate() - dias)
    const { data, error } = await supabase
      .from('ecom_leads')
      .select('criado_em')
      .gte('criado_em', desde.toISOString())
      .range(0, 9999)
    if (error) throw error
    return data || []
  }, [dias])
}

export function useLeadsUmblerIds(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<{ id_umbler: string; nome_umbler: string; leads_mes: number; ultimo_lead: string }[]>(async () => {
    const [{ data: internosData }, { data, error }] = await Promise.all([
      supabase.from('ecom_umbler_vendedor').select('id_membro_umbler').eq('interno', true).range(0,999),
      supabase.from('ecom_leads')
        .select('id_vendedor,nome_vendedor,criado_em')
        .gte('criado_em', start+'T00:00:00')
        .lte('criado_em', end+'T23:59:59')
        .not('id_vendedor', 'is', null)
        .range(0, 9999)
    ])
    if (error) throw error
    const internos = new Set((internosData||[]).map((r:any) => r.id_membro_umbler as string))
    const map = new Map<string,{nome:string; count:number; ultimo:string}>()
    ;(data||[]).forEach((r:any) => {
      if (internos.has(r.id_vendedor)) return
      const cur = map.get(r.id_vendedor) || { nome: r.nome_vendedor || r.id_vendedor, count: 0, ultimo: '' }
      cur.count++
      if (r.criado_em > cur.ultimo) cur.ultimo = r.criado_em
      map.set(r.id_vendedor, cur)
    })
    return [...map.entries()].map(([id, d]) => ({
      id_umbler: id, nome_umbler: d.nome, leads_mes: d.count, ultimo_lead: d.ultimo.slice(0,10)
    })).sort((a,b) => b.leads_mes - a.leads_mes)
  }, [start, end])
}

export function useOrigemLeads(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomOrigemLead[]>(async () => {
    const { data, error } = await supabase
      .from('vw_ecom_origem_leads')
      .select('*')
      .gte('data_lead', start)
      .lte('data_lead', end)
      .range(0, 9999)
    if (error) throw error
    return (data || []).map(r => ({
      ...r,
      leads: Number(r.leads),
      investimento: Number(r.investimento),
      leads_meta: Number(r.leads_meta),
      cpl: Number(r.cpl),
    }))
  }, [start, end])
}
