export type CampaignSignal = 'green' | 'yellow' | 'red'
export type CampaignVerdict = 'ESCALAR' | 'MANTER' | 'MONITORAR' | 'PAUSAR'

export interface CampaignAnalysis {
  campanha: string
  shortName: string
  subgrupos: string[]
  spend: number
  impressoes: number
  cliques: number
  leads: number
  vendas: number
  revenue: number
  roas: number
  cpl: number
  cpa: number
  conversao: number
  pctInvestFat: number
  signal: CampaignSignal
  verdict: CampaignVerdict
  sparkline: number[]
  isPaused: boolean
}

export interface SubgroupAnalysis {
  subgrupo: string
  investimento: number
  faturamento: number
  faturamentoAnterior: number
  deltaPerc: number
  pctInvestFat: number
  roas: number
  campanhas: number
}
