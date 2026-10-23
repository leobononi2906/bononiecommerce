-- 20261023130000_ecom_jornada_capi.sql — RASCUNHO PARA REVISÃO (não aplicada)
--
-- Por quê: Fase 2 da jornada própria. A Edge Function ecom-jornada-capi manda ao Meta (PIXEL TINTIM,
-- action_source 'chat') as mudanças de etapa da ecom_jornada_historico e precisa gravar o resultado.
--
-- O que faz:
--   1. Amplia os status aceitos em ecom_jornada_historico.capi: além de pendente/historico/sem_evento,
--      testado (foi ao Test Events), enviado (foi de verdade), erro (o Meta recusou) e expirado (> 7 dias).
--      É troca de CHECK: o antigo cai e o novo, que aceita tudo o que o antigo aceitava, entra no lugar.
--   2. Cria as colunas resposta_meta (jsonb) e enviado_em.
--   3. Grava em ecom_jornada_controle o destino do envio, que não é segredo: meta_dataset_id (PIXEL TINTIM),
--      meta_test_code (TEST2302, código de teste desse pixel) e meta_modo = 'teste'.
--      'teste' manda só ao Test Events; 'real' manda de verdade; 'desligado' não manda nada.
--
-- O que NÃO faz: não apaga dado nem muda as linhas que já existem.
--
-- Como volta: bloco REVERTER no fim.

alter table public.ecom_jornada_historico drop constraint if exists ecom_jornada_historico_capi_check;
alter table public.ecom_jornada_historico add constraint ecom_jornada_historico_capi_check
  check (capi in ('pendente', 'historico', 'sem_evento', 'testado', 'enviado', 'erro', 'expirado'));

alter table public.ecom_jornada_historico add column if not exists resposta_meta jsonb;
alter table public.ecom_jornada_historico add column if not exists enviado_em timestamptz;

insert into public.ecom_jornada_controle (chave, valor) values
  ('meta_dataset_id', '1943741369503969'),
  ('meta_test_code',  'TEST2302'),
  ('meta_modo',       'teste')
on conflict (chave) do nothing;

-- REVERTER:
--   delete from public.ecom_jornada_controle where chave in ('meta_dataset_id', 'meta_test_code', 'meta_modo');
--   alter table public.ecom_jornada_historico drop column enviado_em, drop column resposta_meta;
--   update public.ecom_jornada_historico set capi = 'pendente' where capi in ('testado', 'erro', 'expirado', 'enviado');
--   alter table public.ecom_jornada_historico drop constraint ecom_jornada_historico_capi_check;
--   alter table public.ecom_jornada_historico add constraint ecom_jornada_historico_capi_check
--     check (capi in ('pendente', 'historico', 'sem_evento'));
