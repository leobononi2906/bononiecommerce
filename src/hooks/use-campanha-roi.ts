import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/query'

// Fonte única de ROI real por campanha (últimos 60 dias, já vem pronta do Supabase — sem join manual).
// Substitui o pipeline antigo (Meta Ads × TikTim × ecom_campanha_subgrupo) para quem só precisa do resultado.
export interface CampanhaRoi {
  campanha: string
  investimento: number
  cliques: number
  leadsMeta: number
  leadsNossos: number
  compraram: number
  faturamento: number
  taxaConvPct: number | null
  cpl: number | null
  roas: number
}

export function useCampanhaRoi() {
  return useQuery<CampanhaRoi[]>(async () => {
    const { data, error } = await supabase
      .from('vw_ecom_campanha_roi')
      .select('*')
      .range(0, 999)
    if (error) throw error
    return (data || []).map((r: any) => ({
      campanha: r.campanha,
      investimento: Number(r.investimento) || 0,
      cliques: Number(r.cliques) || 0,
      leadsMeta: Number(r.leads_meta) || 0,
      leadsNossos: Number(r.leads_nossos) || 0,
      compraram: Number(r.compraram) || 0,
      faturamento: Number(r.faturamento) || 0,
      taxaConvPct: r.taxa_conv_pct != null ? Number(r.taxa_conv_pct) : null,
      cpl: r.cpl != null ? Number(r.cpl) : null,
      roas: Number(r.roas) || 0,
    }))
  }, [])
}
