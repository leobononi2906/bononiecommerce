// Barrel re-export — backward compatibility
// All existing imports from './hooks/useData' continue to work unchanged.

export { useQuery, getPeriodRange, getCanal, MKT_NAMES, SITE_NAMES } from '../lib/query'

export { useFaturamentoPeriodo, useFaturamentoPeriodoAnterior, useFaturamento6Meses } from './use-faturamento'
export { useVendedores, useEsperaVendedor, useUmblerVendedores, useInternos } from './use-vendedores'
export { useLeads, useLeadsUmblerIds, useOrigemLeads } from './use-leads'
export { useSubgrupos, useSubgruposERP, useMarketplaceCanais, useMarketplace6Meses, normMkt } from './use-marketplace'
export type { MktCanal } from './use-marketplace'
export { useCampanhas, useMetaAds, useCampanhaSubgrupos, useMetaAdsAtivos, useMetaAdsDaily } from './use-campaigns'
export {
  useFunilAtendimento, useConfigEtiquetas, salvarPadraoEtiqueta,
  leadCasa, candidatosEtiqueta,
} from './use-funil'
export type { FunilLead, ConfigEtiqueta } from './use-funil'
