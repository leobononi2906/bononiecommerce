import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/query'

// Config de vendedor mora no Hub (portal) — Config → Umbler → Usuários.
// O e-commerce SÓ LÊ vw_ecom_vendedores_ativos (umbler_usuarios segmento='ecommerce' ativo).
// Nada de cadastro/ativação local aqui.
export function useVendedoresAtivosCount() {
  return useQuery<number>(async () => {
    const { count, error } = await supabase
      .from('vw_ecom_vendedores_ativos')
      .select('*', { count: 'exact', head: true })
      .eq('ativo', true)
    if (error) throw error
    return count ?? 0
  }, [])
}
