-- 20261006130000_bling_sync_chave.sql
-- aplicada em produção em 2026-10-06 (chave de 64 caracteres criada; crons 28 e 29 mandam x-sync-key; a função
-- publicada ainda ignora o cabeçalho até receber a checagem — publicar bling-sync e bling-proxy é o passo seguinte)
--
-- Por quê: as Edge Functions bling-sync, bling-proxy e bling-debug respondem a qualquer pessoa, sem
-- login (Verify JWT desligado, e a chave anon pública também passaria por um JWT válido). Cada
-- chamada renova o token do Bling e, no bling-sync com modo=real, escreve preço e estoque no Bling.
--
-- O que faz (só o lado do banco; as funções são publicadas à parte):
--   1. Cria a chave bling_sync_chave em ped_configuracoes (gerada aqui, aleatória, nunca sai do banco).
--      O prefixo bling_ já é service-only pela RLS aplicada em 06/10 (a função lê com a service key).
--   2. Faz os crons 28 (bling-sync-manha) e 29 (bling-sync-tarde) mandarem a chave no cabeçalho
--      x-sync-key, lida da tabela a cada execução. O resto do comando fica como está.
--
-- O que NÃO faz: não muda nada na função (ela ainda ignora o cabeçalho até ser publicada com a
-- checagem), não apaga nada, não mexe nos tokens do Bling. Por isso pode ser aplicada ANTES da
-- publicação da função sem quebrar nada.
--
-- Como volta: bloco REVERTER no fim.

insert into public.ped_configuracoes (chave, valor, descricao)
values (
  'bling_sync_chave',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  'Chave que os crons do bling-sync mandam no cabeçalho x-sync-key. Gerada no banco; não colar em chat.'
)
on conflict (chave) do nothing;

do $$
declare
  j record;
  novo text;
begin
  for j in select jobid, command from cron.job where jobid in (28, 29) and command not like '%x-sync-key%' loop
    novo := regexp_replace(
      j.command,
      '\}''::jsonb,(\s*)body',
      '}''::jsonb || jsonb_build_object(''x-sync-key'', (select valor from public.ped_configuracoes where chave = ''bling_sync_chave'')),\1body'
    );
    if novo = j.command then
      raise exception 'cron % não tem o formato esperado; nada foi alterado', j.jobid;
    end if;
    perform cron.alter_job(j.jobid, command := novo);
  end loop;
end $$;

-- REVERTER:
--   -- crons: tirar o trecho "|| jsonb_build_object('x-sync-key', ...)" do headers dos jobs 28 e 29
--   --        (cron.alter_job com o comando original: headers := '{...apikey...}'::jsonb, body := '{}'::jsonb)
--   delete from public.ped_configuracoes where chave = 'bling_sync_chave';
