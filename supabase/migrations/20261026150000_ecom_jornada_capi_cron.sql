-- 20261026150000_ecom_jornada_capi_cron.sql
-- aplicada em produção em 2026-10-26 (cron job 171). 1ª rodada 12:05 UTC: modo teste, 200 de 200 aceitos.
--
-- Por quê: a ecom-jornada-capi (envio da jornada ao Meta, hoje em modo 'teste') só roda quando alguém
-- chama à mão. Para rodar sozinha, o cron precisa mandar a chave x-capi-key, e ela não pode passar
-- por chat, painel nem arquivo.
--
-- O que faz:
--   1. Gera uma chave aleatória DENTRO do banco e guarda só no Vault (`capi_cron_key`). Ninguém a vê.
--   2. Cria ecom_capi_chave_confere(p_chave): a função de borda pergunta ao banco se a chave confere
--      (só service_role executa).
--   3. Agenda o cron `ecom-jornada-capi` a cada 10 min (5, 15, 25…, logo depois da rotina da jornada,
--      que roda em 0, 10, 20…), lendo a chave do Vault no momento da chamada.
--
-- O que NÃO faz: não muda o modo do envio (`ecom_jornada_controle.meta_modo` continua 'teste': só Test
-- Events, não conta conversão; o Tintim segue mandando de verdade). Não apaga nada.
--
-- Depende de: a ecom-jornada-capi publicada com a conferência pelo banco (commit desta migration).
-- Antes disso o cron chamaria e levaria 401, sem efeito nenhum.
--
-- Como volta: select cron.unschedule('ecom-jornada-capi');
--             drop function public.ecom_capi_chave_confere(text);
--             delete from vault.secrets where name = 'capi_cron_key';

select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'capi_cron_key',
                           'x-capi-key do cron da ecom-jornada-capi (gerada no banco, 26/10/2026)')
where not exists (select 1 from vault.secrets where name = 'capi_cron_key');

create or replace function public.ecom_capi_chave_confere(p_chave text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(p_chave, '') <> ''
     and exists (select 1 from vault.decrypted_secrets where name = 'capi_cron_key' and decrypted_secret = p_chave);
$function$;

revoke all on function public.ecom_capi_chave_confere(text) from public, anon, authenticated;
grant execute on function public.ecom_capi_chave_confere(text) to service_role;

select cron.schedule('ecom-jornada-capi', '5-59/10 * * * *', $cron$
  select net.http_post(
    url := 'https://vishxwdxqiygbxmtpfoy.supabase.co/functions/v1/ecom-jornada-capi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-capi-key', (select decrypted_secret from vault.decrypted_secrets where name = 'capi_cron_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000);
$cron$);
