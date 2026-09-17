-- vw_ecom_docs_datas
-- aplicada em produção em 2026-09-17
--
-- O QUE FAZ: expõe, a nível de DOCUMENTO (não de item), a data de criação do pedido
-- (data_criacao/data_doc), que hoje só existe em vw_comercial_itens_margem no grão de item.
-- Isso permite ao bononiecommerce filtrar faturamento pela data em que o pedido foi FEITO,
-- em vez da data em que o ERP faturou a nota — as duas divergem quando um lote de pedidos
-- antigos é faturado de uma vez (caso real: lote de 26 pedidos fev-ago faturado em 03/09/2026,
-- inflando o card "Faturamento do Site" de R$16k reais para R$41k na tela).
--
-- O QUE NÃO FAZ: não altera vw_comercial_itens_margem nem nenhuma vw_* de espelho do ERP.
-- Não escreve em nenhuma tabela. Não apaga nada.
--
-- Pré-voo (2026-09-17, produção): 0 documentos com mais de uma data_criacao/data_doc entre
-- seus itens — o DISTINCT ON não escolhe entre valores divergentes, o valor é único por doc.
-- Volume esperado: 31.143 linhas (1 por documento de vw_comercial_itens_margem).

create or replace view vw_ecom_docs_datas as
select distinct on (tipo_doc, id_doc, id_empresa)
       tipo_doc, id_doc, id_empresa, data_criacao, data_doc
  from vw_comercial_itens_margem
 order by tipo_doc, id_doc, id_empresa, id;

grant select on vw_ecom_docs_datas to anon, authenticated, service_role;
