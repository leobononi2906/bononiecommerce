import { supabase } from '../lib/supabase'
import { useQuery, getPeriodRange } from '../lib/query'
import type { Periodo } from '../types'

// Fonte única de ROI real por campanha, filtrável pelo período selecionado no topo.
// Chama a RPC ecom_campanha_roi(inicio, fim) — mesma lógica da antiga vw_ecom_campanha_roi
// (que era fixa em 60 dias): investimento pela data do anúncio, leads/vendas pela data do lead.
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

export function useCampanhaRoi(periodo: Periodo) {
  const { start, end } = getPeriodRange(periodo)
  return useQuery<CampanhaRoi[]>(async () => {
    const { data, error } = await supabase
      .rpc('ecom_campanha_roi', { p_inicio: start, p_fim: end })
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
  }, [start, end])
}
