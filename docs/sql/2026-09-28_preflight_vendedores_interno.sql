-- Pré-voo (só leitura) da correção 2026-09-28_correcao_vendedores_interno.sql
select id_membro_umbler, id_vendedor_erp, nome_vendedor_erp, ativo, interno
from ecom_umbler_vendedor
order by id_vendedor_erp;
