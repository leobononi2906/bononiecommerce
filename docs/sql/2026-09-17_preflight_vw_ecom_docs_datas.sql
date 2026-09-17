-- Pré-voo (somente SELECT) para a criação de vw_ecom_docs_datas.
-- Objetivo: expor a data de CRIAÇÃO do pedido a nível de documento (hoje só existe a
-- nível de item, em vw_comercial_itens_margem), para o bononiecommerce filtrar
-- faturamento do site pela data do pedido em vez da data de faturamento.
-- Ver docs/STATUS.md (17/09/2026) para o caso concreto que motivou isto.

select 'G-fingerprint'::text as bloco, 'banco'::text as item, current_database()::text as valor
union all
select 'G-fingerprint', 'docs_faturados (vw_comercial_docs_faturados)', (select count(*) from vw_comercial_docs_faturados)::text
union all
select 'G-fingerprint', 'linhas vw_comercial_itens_margem', (select count(*) from vw_comercial_itens_margem)::text

union all

-- A. Objetos — o que a migration CRIA deve faltar; o que ela LÊ deve existir
select 'A-objetos', 'vw_ecom_docs_datas existe? (deve ser 0)',
       (select count(*) from information_schema.views
         where table_schema='public' and table_name='vw_ecom_docs_datas')::text
union all
select 'A-objetos', 'vw_comercial_itens_margem existe? (deve ser 1)',
       (select count(*) from information_schema.views
         where table_schema='public' and table_name='vw_comercial_itens_margem')::text
union all
select 'A-objetos', 'vw_comercial_docs_margem existe? (deve ser 1)',
       (select count(*) from information_schema.views
         where table_schema='public' and table_name='vw_comercial_docs_margem')::text

union all

-- B. Um documento tem SEMPRE a mesma data_criacao/data_doc em todos os seus itens?
-- Se não, o DISTINCT ON da view nova escolheria uma data arbitrária entre várias.
select 'B-consistencia', 'docs com mais de 1 data_criacao distinta entre itens (deve ser 0)',
       (select count(*) from (
          select tipo_doc, id_doc, id_empresa
            from vw_comercial_itens_margem
           group by 1,2,3
          having count(distinct data_criacao) > 1
        ) x)::text
union all
select 'B-consistencia', 'docs com mais de 1 data_doc distinta entre itens (deve ser 0)',
       (select count(*) from (
          select tipo_doc, id_doc, id_empresa
            from vw_comercial_itens_margem
           group by 1,2,3
          having count(distinct data_doc) > 1
        ) x)::text

union all

-- E. Volume esperado da view nova (1 linha por documento)
select 'E-volume', 'documentos distintos em vw_comercial_itens_margem (linhas esperadas na view nova)',
       (select count(distinct (tipo_doc, id_doc, id_empresa)) from vw_comercial_itens_margem)::text

union all

-- Teste de aceite, já no pré-voo: os números que a investigação achou continuam batendo?
select 'aceite-referencia', 'canal site/tray, CRIADO 01-17/09/2026 (esperado ~16.263,92 / 3 docs)',
       (select round(sum(tot),2)::text || ' em ' || count(*)::text || ' docs' from (
          select distinct on (tipo_doc, id_doc, id_empresa) tipo_doc, id_doc, id_empresa,
                 (select sum(i2.total_item) from vw_comercial_itens_margem i2
                   where i2.tipo_doc=i.tipo_doc and i2.id_doc=i.id_doc and i2.id_empresa=i.id_empresa) as tot
            from vw_comercial_itens_margem i
           where i.id_vendedor in (71580, 77364, 81731)
             and i.data_criacao between '2026-09-01' and '2026-09-17'
           order by tipo_doc, id_doc, id_empresa, i.id
        ) d)

order by 1;
