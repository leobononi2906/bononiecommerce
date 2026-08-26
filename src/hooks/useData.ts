// Barrel re-export — backward compatibility
// All existing imports from './hooks/useData' continue to work unchanged.

export { useQuery, getPeriodRange, getCanal, MKT_NAMES, SITE_NAMES } from '../lib/query'

export { useFaturamentoPeriodo, useFaturamentoPeriodoAnterior, useFaturamento6Meses } from './use-faturamento'
export { useDevolucaoPeriodo, useDevolucaoPeriodoAnterior, useDevolucao6Meses } from './use-devolucao'
export { useVendedores, useEsperaVendedor, useTempoResposta, useUmblerVendedores, useInternos } from './use-vendedores'
export type { TempoRespVend } from './use-vendedores'
export { useLeads, useLeadsRecentes, useLeadsUmblerIds, useOrigemLeads } from './use-leads'
export { useSubgrupos, useSubgruposERP, useMarketplaceCanais, useMarketplace6Meses, useMarketplaceProdutos6Meses, normMkt, MKT_CANAIS } from './use-marketplace'
export type { MktCanal, MktProdutoRow } from './use-marketplace'
export { useCampanhas, useMetaAds, useCampanhaSubgrupos, useMetaAdsAtivos, useMetaAdsDaily } from './use-campaigns'
export {
  useFunilAtendimento, useConfigEtiquetas, salvarPadraoEtiqueta,
  leadCasa, candidatosEtiqueta,
} from './use-funil'
export type { FunilLead, ConfigEtiqueta } from './use-funil'
