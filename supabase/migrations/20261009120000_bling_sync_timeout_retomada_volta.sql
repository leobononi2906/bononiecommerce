-- Volta de 20261009120000_bling_sync_timeout_retomada.sql
select cron.alter_job(
  job_id  := jobid,
  command := replace(command, E'timeout_milliseconds := 130000,\n    body := ', 'body := ')
)
from cron.job
where jobname in ('bling-sync-manha', 'bling-sync-tarde')
  and command like '%timeout_milliseconds := 130000%';

delete from public.ped_configuracoes where chave = 'bling_sync_proxima_pagina';
