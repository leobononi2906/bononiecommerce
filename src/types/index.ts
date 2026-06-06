export interface EcomResumo {
  investimento_total: number
  total_leads: number
  total_convertidos: number
  taxa_conversao_perc: number
  receita_total: number
  roas_geral: number
  custo_por_lead: number
}

export interface EcomVendedor {
  nome_vendedor: string
  id_vendedor_erp: number
  departamento: string
  leads_atendidos: number
  convertidos: number
  taxa_conversao_perc: number
  tempo_medio_horas: number
  ultimo_lead: string
  faturamento_erp: number
  ticket_medio: number
  qtd_docs: number
}

export interface EcomCampanha {
  data: string
  campanha: string
  conjunto: string
  impressoes: number
  cliques: number
  investimento: number
  leads_umbler: number
  convertidos: number
  taxa_conversao_perc: number | null
  receita_gerada: number
  custo_por_lead: number | null
  custo_por_venda: number | null
  roas: number
}

export interface EcomFunil {
  data: string
  impressoes: number
  cliques: number
  leads: number
  convertidos: number
  ctr_perc: number
  taxa_lead_perc: number
  taxa_conversao_perc: number
  investimento: number
}

export interface EcomMarketplace {
  nome_vendedor: string
  id_vendedor: number
  faturamento_bruto: number
  taxa_marketplace: number  // maps to taxa_total in vw_ecom_marketplace
  taxa_total?: number
  faturamento_liquido: number
  custo_total: number
  margem_liquida: number
  margem_liquida_perc: number
}

export interface EcomSubgrupo {
  subgrupo: string
  data_faturamento: string
  qtd_vendida: number
  faturamento: number
  custo_total: number
  margem_total: number
  margem_perc: number
}

export interface EcomEsperaVendedor {
  nome_vendedor: string
  id_vendedor: string
  data_ref: string
  total_atendidos: number
  em_fila: number
  tempo_medio_min: number
  tempo_min_min: number
  tempo_max_min: number
  atendidos_em_5min: number
  atendidos_5_15min: number
  atendidos_acima_15min: number
}

export interface EcomUmblerVendedor {
  id_membro_umbler: string
  nome_vendedor_erp: string
  nome_vendedor_erp_completo: string | null
  id_vendedor_erp: number
  ativo: boolean
  criado_em: string
}

export interface FaturamentoMensal {
  mes: string
  nome_vendedor: string
  departamento: string | null
  faturamento: number
  qtd_docs: number
}

export interface EcomMetaAds {
  data: string
  campanha: string
  conjunto: string
  impressoes: number
  cliques: number
  investimento: number
  leads: number
}

export interface EcomCampanhaSubgrupo {
  id: number
  campanha: string
  subgrupo_produto: string
  created_at: string
  updated_at: string
}

export type Periodo = 'mes_atual' | 'mes_anterior' | '3_meses' | '6_meses'
