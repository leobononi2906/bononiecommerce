-- 20261023120100_ecom_jornada_cron.sql
-- aplicada em produção em 2026-10-23: carga de 5.627 leads; cron job 161. A 1ª rodada (12:00 UTC) deu
-- succeeded, processado_ate andou para 12:00:01, +1 lead e 3 mudanças pendentes.
--
-- Aplicar DEPOIS da 20261023120000_ecom_jornada.sql.
-- 1. Carga inicial dos últimos 30 dias, marcada como 'historico' (não vai ao Meta).
-- 2. Agenda a rotina a cada 10 min. Cada rodada lê de onde a anterior parou (ecom_jornada_controle).
--
-- Como volta: select cron.unschedule('ecom-jornada-processar');

select public.ecom_jornada_processar(now() - interval '30 days', now(), true);

select cron.schedule('ecom-jornada-processar', '*/10 * * * *',
                     $cron$select public.ecom_jornada_processar()$cron$);
