# STATUS — E-commerce Stonni (Dashboard)

> Atualizado: 2026-08-11

## O que é
Dashboard do e-commerce Stonni: faturamento por canal, marketing (Meta Ads), marketplace (ML/Shopee), atendimento (funil + tempo de resposta) e relatórios. App de **baixo uso** — o Leo autorizou "mandar bala" (quebrar não é problema, ≠ atacado).

## Onde está
- **Clone real (git):** `C:\CLAUDE\Projetos GitHub\bononiecommerce\temp_clone` (remote `leobononi2906/bononiecommerce`, branch `main`).
  ⚠️ A raiz `bononiecommerce\` é wrapper (docs + xlsx soltos) — o código vive em `temp_clone/`. **SEMPRE `git fetch` antes** (tem sessão paralela commitando na main).
- **Deploy:** https://bononiecommerce.vercel.app · push na `main` → Vercel automático.
- **Supabase:** `vishxwdxqiygbxmtpfoy` (tabelas/views `ecom_*`, intake `umbler_*`).
- **Stack:** React/Vite com **inline styles + CSS vars próprias** (`--blue-dark`, `--green`…), **NÃO Tailwind**. Hooks em `src/hooks/`.

## Fluxo de dados (Umbler)
Migrado pro **intake único** (passo 3): canais OFICIAL LV/LF → edge `umbler-intake` → `Ecomm_UMBLER` v83 (downstream fino, só cria `ecom_leads`/`ecom_leads_fila_bot`). Raw vive em `umbler_eventos.payload`. Funil de conversão = `ecom_atd_funil` (cron `ecom-atd-refresh`, jobid 45) cruzando contato Umbler × faturamento ERP por `bononi_telefone_key`.

## Estado atual (produção, remodela 06–07/08/2026)
- **Home**: cards com comparativo "vs período anterior" + aviso de mês parcial.
- **Marketing**: Meta Ads com faixa de tendência 6m + aviso de mês parcial.
- **Marketplace**: reescrito como **tendência por canal** (ML Battogo/Bononi/Full/Shopee): faturamento, pedidos, ticket, Δ R$/% vs período anterior, sparkline 6m, barra empilhada. (Removida toda a gestão de estoque ML Full.)
- **Atendimento**: funil de vendedores (`FunilVendedores.tsx`), mapa de calor 24h, **TMR revivida** via `vw_ecom_tempo_resposta` (mediana, fonte `umbler_mensagens`).
- **Relatórios/Vendedores**: filtros amplos 6m, agrupamento por mês, gráfico faturamento/vendedor.

## Pendências / próximos passos
- [ ] **Mover OFICIAL LV/LF pra Aplicação "GERAL SUPABASE"** na UI da Umbler e remover o webhook dedicado antigo (só o Leo faz). Enquanto coexistir = entrega dupla (não quebra).
- [ ] Otimizar `vw_ecom_campanha_conversao` (500 intermitente por timeout; com filtro `mes_ref` responde 200).
- [ ] Expor o funil `ecom_atd_funil`/comprou_erp de forma mais completa no front.

## Dívidas e armadilhas conhecidas
- **Bundle antigo em cache no navegador** foi a causa real de vários "bugs" que o Leo viu (Home em branco, #id/produtos vazios) — **hard refresh / redeploy** resolve; as queries e CORS estão OK.
- TMR antiga (`vw_ecom_espera_vendedor`, filtro `etapa='ECOMMERCE...'`) **morreu na migração Umbler** — não usar; casar por telefone dá tempos absurdos.
- Tabelas `ecom_umbler_conversas/mensagens` e `ecom_debug_webhook` (1,4 GB) foram dropadas/truncadas — o raw agora é `umbler_eventos.payload`.

## Dev-log
- 2026-08-07 — TMR revivida (`vw_ecom_tempo_resposta*`, mediana); lote Atendimento/Relatórios/Vendedores.
- 2026-08-06 — Remodela: Marketplace por canal, comparativos + aviso de mês parcial, TMR removida do ranking.
- 2026-07-31 — Migração pro intake único (`Ecomm_UMBLER` v83); funil repontado p/ `bononi_telefone_key`; conversão +15 vendas/+R$86k.
