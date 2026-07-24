// Barrel re-export — backward compatibility
// All existing imports from './hooks/useData' continue to work unchanged.

export { useQuery, getPeriodRange, getCanal, MKT_NAMES, SITE_NAMES } from '../lib/query'

export { useFaturamentoPeriodo, useFaturamento6Meses } from './use-faturamento'
export { useVendedores, useEsperaVendedor, useUmblerVendedores, useInternos } from './use-vendedores'
export { useLeads, useLeadsUmblerIds, useOrigemLeads } from './use-leads'
export { useSubgrupos, useSubgruposERP } from './use-marketplace'
export { useCampanhas, useMetaAds, useCampanhaSubgrupos, useMetaAdsAtivos, useMetaAdsDaily } from './use-campaigns'
