-- Ensaio de aceite (roda em transação e desfaz) — cria a view temporariamente e confere
-- que o filtro por data_criacao reproduz os números da investigação:
--   * julho/2026 continua em R$ 57.139,80 (nenhum backlog naquele mês)
--   * 01-17/09/2026 no canal site/tray cai para R$ 16.263,92 em 3 docs (não R$ 40.788,59 em 29)

create or replace view vw_ecom_docs_datas as
select distinct on (tipo_doc, id_doc, id_empresa)
       tipo_doc, id_doc, id_empresa, data_criacao, data_doc
  from vw_comercial_itens_margem
 order by tipo_doc, id_doc, id_empresa, id;

select 'julho-2026 (esperado 57139.80)' as caso,
       round(sum(m.faturamento_doc), 2) as valor,
       count(*) as docs
  from vw_comercial_docs_margem m
  join vw_ecom_docs_datas d
    on d.tipo_doc = m.tipo_doc and d.id_doc = m.id_doc and d.id_empresa = m.id_empresa
 where m.tipo_saida = 'ONLINE'
   and m.id_vendedor in (71580, 77364, 81731)
   and d.data_criacao between '2026-07-01' and '2026-07-31'

union all

select 'set-01a17 CRIADO (esperado 16263.92 / 3 docs)',
       round(sum(m.faturamento_doc), 2),
       count(*)
  from vw_comercial_docs_margem m
  join vw_ecom_docs_datas d
    on d.tipo_doc = m.tipo_doc and d.id_doc = m.id_doc and d.id_empresa = m.id_empresa
 where m.tipo_saida = 'ONLINE'
   and m.id_vendedor in (71580, 77364, 81731)
   and d.data_criacao between '2026-09-01' and '2026-09-17'

union all

select 'set-01a17 FATURADO, pra contraste (a tela hoje, 40788.59 / 29 docs)',
       round(sum(m.faturamento_doc), 2),
       count(*)
  from vw_comercial_docs_margem m
 where m.tipo_saida = 'ONLINE'
   and m.id_vendedor in (71580, 77364, 81731)
   and m.data_faturamento between '2026-09-01' and '2026-09-17';
