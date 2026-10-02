-- Correção de dado: 5 vendedores marcados "Interno" em ecom_umbler_vendedor
--
-- Por quê: com os 6 vínculos em interno=true, nenhum vendedor passava no filtro
-- "ativo && !interno" da Home/Vendedores — Faturamento Vendedores saía R$ 0,00 em
-- set e ago/2026 (real ≈ R$ 673 mil / R$ 685 mil), e os leads deles saíam do funil.
-- "Interno" não é hierarquia nem acesso: só tira a pessoa das contas de vendedor.
--
-- Faz: interno=false nos 5 vendedores (id_vendedor_erp 69260 ALEX, 39676 GIULIANO,
--      85193 MAYKELL, 55417 VITOR, 88118 PEDRO).
-- Não faz: não toca o KAUAN MKT (id_vendedor_erp 0, segue interno), não apaga nada.
-- Volta: o mesmo update com interno = true nos mesmos ids.
--
-- Autorizado pelo Leo em 2026-09-28.
-- aplicada em produção em 2026-09-28 — 5 linhas (returning = pré-voo), KAUAN MKT intacto.

update ecom_umbler_vendedor
set interno = false
where id_vendedor_erp in (69260, 39676, 85193, 55417, 88118)
  and interno = true
returning id_membro_umbler, id_vendedor_erp, nome_vendedor_erp, ativo, interno;
