-- 20261006120000_ecom_fecha_anon.sql  — RASCUNHO PARA REVISÃO (não aplicada)
--
-- O que faz:
--   1. Cria ecom_tem_acesso() — mesma regra do dp_tem_acesso() do RH, para o módulo 'ecommerce'
--      (admin global, ou 'ecommerce' em modulos/admin_modulos do JWT).
--   2. Nas 12 tabelas que SÓ o bononiecommerce usa: liga RLS, troca as policies antigas por uma
--      que exige ecom_tem_acesso(), e tira do anon qualquer permissão.
--   3. Nas 11 views vw_ecom_* (só o bononiecommerce usa): tira o anon e deixa o authenticated
--      só com SELECT.
--   4. ecom_campanha_roi(): tira o EXECUTE do anon.
--
-- O que NÃO faz:
--   - Não apaga dado, tabela, coluna nem view. Não muda definição de view.
--   - Não toca em ecom_leads (o bononi-vendas ainda lê com a chave anon), nem em vw_comercial_*,
--     vw_vendas_sem_faturamento e exp_documentos (a Loja, sem login, e outros 7 apps leem).
--   - Não afeta service_role (Edge Functions, crons e replicador ignoram RLS).
--
-- ORDEM: só aplicar DEPOIS que o bononiecommerce com login estiver no ar e conferido.
--        Antes disso, o dashboard publicado (que usa a chave anon) para de carregar.
--
-- Como volta: ver o bloco "REVERTER" no fim do arquivo.

create or replace function public.ecom_tem_acesso()
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'admin', '') = 'true'
      or coalesce((auth.jwt() -> 'user_metadata' -> 'modulos') ? 'ecommerce', false)
      or coalesce((auth.jwt() -> 'user_metadata' -> 'admin_modulos') ? 'ecommerce', false);
$function$;

revoke all on function public.ecom_tem_acesso() from public, anon;
grant execute on function public.ecom_tem_acesso() to authenticated, service_role;

-- ── Tabelas exclusivas do e-commerce ─────────────────────────────────────────
do $$
declare
  t text;
  p record;
  tabelas text[] := array[
    'bling_sync_overrides', 'ecom_atd_config_etiqueta', 'ecom_atd_funil', 'ecom_campanha_subgrupo',
    'ecom_meta_ads', 'ecom_umbler_vendedor', 'meta_capi_eventos',
    'mkt_followups', 'mkt_modalidades', 'mkt_nichos', 'mkt_parceiro_acordos', 'mkt_parceiros'
  ];
begin
  foreach t in array tabelas loop
    execute format('alter table public.%I enable row level security', t);

    -- policies antigas saem: as mkt_*_auth eram "authenticated using (true)", ou seja,
    -- qualquer login do projeto entraria assim que a RLS ligasse.
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format(
      'create policy %I on public.%I for all to authenticated using (public.ecom_tem_acesso()) with check (public.ecom_tem_acesso())',
      t || '_modulo', t);

    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, references, trigger on public.%I from authenticated', t);
  end loop;
end $$;

-- ── Views vw_ecom_* ──────────────────────────────────────────────────────────
-- View roda com os direitos do dono, então RLS nas tabelas de baixo não vale aqui:
-- o corte é por permissão. Quem está logado (qualquer módulo) ainda lê — fechar por
-- módulo exigiria mudar a definição das views, fora deste escopo.
do $$
declare
  v text;
  views text[] := array[
    'vw_ecom_campanhas', 'vw_ecom_campanha_conversao', 'vw_ecom_campanha_detalhe',
    'vw_ecom_devolucao_externa', 'vw_ecom_docs_datas', 'vw_ecom_espera_vendedor',
    'vw_ecom_origem_leads', 'vw_ecom_subgrupos', 'vw_ecom_tempo_resposta',
    'vw_ecom_vendedores', 'vw_ecom_vendedores_ativos'
  ];
begin
  foreach v in array views loop
    execute format('revoke all on public.%I from anon', v);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', v);
  end loop;
end $$;

-- ── RPC ──────────────────────────────────────────────────────────────────────
revoke execute on function public.ecom_campanha_roi from public, anon;
grant execute on function public.ecom_campanha_roi to authenticated, service_role;

-- REVERTER (cola e roda, se algo quebrar):
--   -- tabelas: para cada t da lista acima
--   --   drop policy t_modulo on public.t; alter table public.t disable row level security;
--   --   grant all on public.t to anon;  grant all on public.t to authenticated;
--   -- views: grant all on public.<view> to anon, authenticated;
--   -- RPC:   grant execute on function public.ecom_campanha_roi to anon, public;
--   -- As policies mkt_fol_auth / mkt_nic_auth / mkt_par_auth (authenticated, using true) eram
--   -- as únicas que existiam; recriar só se quiser o estado idêntico (com RLS desligada elas
--   -- não faziam nada).
