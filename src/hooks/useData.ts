// Barrel re-export — backward compatibility
// All existing imports from './hooks/useData' continue to work unchanged.

export { useQuery, getPeriodRange, getPreviousPeriodRange, periodoLabel, periodoLabelAnterior, getCanal, MKT_NAMES, SITE_NAMES, diasComPedidoRepresado } from '../lib/query'

export { useFaturamentoPeriodo, useFaturamentoPeriodoAnterior, useFaturamento6Meses,
  useFaturamentoSitePeriodo, useFaturamentoSitePeriodoAnterior, useFaturamentoSite6Meses,
  useFaturamentoVendedorSemNotaPeriodo, useFaturamentoVendedorSemNotaPeriodoAnterior,
  comDataDePedido } from './use-faturamento'
export { useDevolucaoPeriodo, useDevolucaoPeriodoAnterior, useDevolucao6Meses, useDevolucaoPorVendedorPeriodo, useDevolucaoItens } from './use-devolucao'
export type { DevItemRaw } from './use-devolucao'
export { useVendedores, useEsperaVendedor, useTempoResposta, useUmblerVendedores, useInternos } from './use-vendedores'
export type { TempoRespVend } from './use-vendedores'
export { useLeads, useLeadsRecentes, useLeadsUmblerIds, useOrigemLeads } from './use-leads'
export { useSubgrupos, useSubgruposERP, useMarketplaceCanais, useMarketplace6Meses, useMarketplace6MesesPorPedido, useMarketplaceProdutos6Meses, useMktCanais, normMkt, rotuloCanal } from './use-marketplace'
export type { MktCanal, MktProdutoRow, MktCanalId } from './use-marketplace'
export { useCampanhas, useMetaAds, useCampanhaSubgrupos, useMetaAdsAtivos, useMetaAdsDaily } from './use-campaigns'
export {
  useFunilAtendimento, useConfigEtiquetas, salvarPadraoEtiqueta,
  leadCasa, candidatosEtiqueta,
} from './use-funil'
export type { FunilLead, ConfigEtiqueta } from './use-funil'
export { useCampanhaRoi } from './use-campanha-roi'
export type { CampanhaRoi } from './use-campanha-roi'
export { useVendedoresAtivosCount } from './use-vendedores-ativos'
