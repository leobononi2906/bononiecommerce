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

export interface TempoRespVend {
  nome: string; total: number; media: number; mediana: number
  min: number; max: number; a5: number; a515: number; acima: number
}
function mediana(arr: number[]): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Tempo de resposta (1ª msg cliente → 1ª resposta vendedor) por vendedor no período.
 *  Fonte: vw_ecom_tempo_resposta (umbler_mensagens). Só vendedores cadastrados e não-internos. */
export function useTempoResposta(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<{ vendedores: TempoRespVend[]; geralMedia: number; geralMediana: number; geralTotal: number }>(async () => {
    const [{ data: mapa }, { data: rows, error }] = await Promise.all([
      supabase.from('ecom_umbler_vendedor').select('id_membro_umbler,nome_vendedor_erp,interno').range(0, 9999),
      supabase.from('vw_ecom_tempo_resposta')
        .select('id_membro_umbler,data_ref,minutos_resposta')
        .gte('data_ref', start).lte('data_ref', end)
        .not('id_membro_umbler', 'is', null)
        .range(0, 9999),
    ])
    if (error) throw error
    const lookup = new Map<string, { nome: string | null; interno: boolean }>()
    ;(mapa || []).forEach((m: any) => lookup.set(m.id_membro_umbler, { nome: m.nome_vendedor_erp, interno: !!m.interno }))

    const porVend = new Map<string, number[]>()
    const todos: number[] = []
    ;(rows || []).forEach((r: any) => {
      const info = lookup.get(r.id_membro_umbler)
      if (!info || !info.nome || info.interno) return   // só cadastrados, não-internos
      const min = Number(r.minutos_resposta)
      if (!isFinite(min)) return
      const arr = porVend.get(info.nome) || []
      arr.push(min); porVend.set(info.nome, arr); todos.push(min)
    })

    const vendedores: TempoRespVend[] = [...porVend.entries()].map(([nome, arr]) => ({
      nome,
      total: arr.length,
      media: arr.reduce((s, v) => s + v, 0) / arr.length,
      mediana: mediana(arr),
      min: Math.min(...arr),
      max: Math.max(...arr),
      a5: arr.filter(v => v <= 5).length,
      a515: arr.filter(v => v > 5 && v <= 15).length,
      acima: arr.filter(v => v > 15).length,
    })).sort((a, b) => a.mediana - b.mediana)

    return {
      vendedores,
      geralMedia: todos.length ? todos.reduce((s, v) => s + v, 0) / todos.length : 0,
      geralMediana: mediana(todos),
      geralTotal: todos.length,
    }
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
