import { supabase } from '../lib/supabase'
import { useQuery, getPeriodRange } from '../lib/query'
import type { EcomVendedor, EcomEsperaVendedor, EcomUmblerVendedor, Periodo } from '../types'

export function useVendedores() {
  return useQuery<EcomVendedor[]>(async () => {
    const { data, error } = await supabase.from('vw_ecom_vendedores').select('*').range(0,9999)
    if (error) throw error
    return (data||[]).map(r => ({
      ...r,
      faturamento_erp: Number(r.faturamento_erp),
      ticket_medio: Number(r.ticket_medio),
      taxa_conversao_perc: Number(r.taxa_conversao_perc),
      tempo_medio_horas: Number(r.tempo_medio_horas),
      convertidos: Number(r.convertidos),
      qtd_docs: Number(r.qtd_docs),
    }))
  }, [])
}

export function useEsperaVendedor(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<EcomEsperaVendedor[]>(async () => {
    const [{ data: mapa }, { data: maxDate }] = await Promise.all([
      supabase.from('ecom_umbler_vendedor').select('id_membro_umbler,nome_vendedor_erp').range(0,9999),
      supabase.from('vw_ecom_espera_vendedor').select('data_ref').order('data_ref', {ascending:false}).limit(1),
    ])
    let s = start, e = end
    if (maxDate && maxDate[0]) {
      const lastDate = maxDate[0].data_ref as string
      if (lastDate < start) {
        const d = new Date(lastDate); e = lastDate; d.setDate(d.getDate() - 60); s = d.toISOString().slice(0,10)
      }
    }
    const { data: espera, error } = await supabase
      .from('vw_ecom_espera_vendedor').select('*').gte('data_ref',s).lte('data_ref',e).range(0,9999)
    if (error) throw error
    const lookup: Record<string,string> = {}
    ;(mapa||[]).forEach((m:any) => { lookup[m.id_membro_umbler] = m.nome_vendedor_erp })
    return (espera||[])
      .filter(r => Number(r.tempo_medio_min) > 0)
      .map(r => ({
        ...r,
        nome_vendedor: lookup[r.id_vendedor] || r.nome_vendedor,
        tempo_medio_min: Number(r.tempo_medio_min),
        tempo_min_min: Math.max(0, Number(r.tempo_min_min)),
        tempo_max_min: Math.max(0, Number(r.tempo_max_min)),
      }))
  }, [start, end])
}

export function useUmblerVendedores() {
  return useQuery<EcomUmblerVendedor[]>(async () => {
    const { data, error } = await supabase.from('ecom_umbler_vendedor').select('*').range(0,9999)
    if (error) throw error
    return data || []
  }, [])
}

export function useInternos() {
  return useQuery<Set<string>>(async () => {
    const { data, error } = await supabase
      .from('ecom_umbler_vendedor')
      .select('id_membro_umbler')
      .eq('interno', true)
      .range(0, 999)
    if (error) throw error
    return new Set((data||[]).map((r:any) => r.id_membro_umbler as string))
  }, [])
}
