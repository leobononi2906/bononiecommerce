-- bling-sync: cron espera a resposta e a função retoma de onde parou.
-- Causa (09/10/2026): net.http_post sem timeout_milliseconds desiste em 5 s; o sync leva mais de 1 min.
-- Não apaga nada. Volta: 20261009120000_bling_sync_timeout_retomada_volta.sql

-- 1) Espera até 130 s (a função se limita a 110 s). Só altera os dois jobs do bling-sync, só se ainda
--    não tiverem o parâmetro; a chave e o restante do comando ficam como estão.
select cron.alter_job(
  job_id  := jobid,
  command := replace(command, 'body := ', E'timeout_milliseconds := 130000,\n    body := ')
)
from cron.job
where jobname in ('bling-sync-manha', 'bling-sync-tarde')
  and command not like '%timeout_milliseconds%';

-- 2) Ponteiro de retomada (a função cria sozinha se faltar; aqui só deixa visível).
insert into public.ped_configuracoes (chave, valor, descricao, tipo)
values ('bling_sync_proxima_pagina', '1', 'Próxima página do bling-sync (retomada entre rodadas do cron)', 'number')
on conflict (chave) do nothing;
