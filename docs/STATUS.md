# STATUS — E-commerce Stonni (Dashboard)

> Atualizado: 2026-08-26

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

## Estado atual (produção, 26/08/2026)
- **Home**: cards com comparativo "vs período anterior" + aviso de mês parcial. Faixa "Líquido após devolução externa" (bruto→devolução→líquido). Seção "Tráfego — retorno sobre investimento": ROAS geral = (faturamento site + vendedores) ÷ investimento Meta Ads no período (fix 26/08, base pedida pelo Leo — tráfego alimenta os dois canais, não só o site), CAC = investimento ÷ pedidos, Ticket médio do site.
- **Marketing**: Meta Ads com faixa de tendência 6m + aviso de mês parcial. Pipeline de atribuição antigo (Meta Ads × TikTim × `ecom_campanha_subgrupo`, `useCampaignVerdicts`) continua aqui, sem mudança.
- **Campanhas — ROI real** (`/campanhas-roi`, nova 26/08, sub-aba de Marketing): fonte única `vw_ecom_campanha_roi` — sem pipeline manual. KPIs (Investimento/Leads/CPL/Faturamento/ROAS) + tabela ordenável por investimento/leads/compraram/faturamento/ROAS, chip verde/vermelho, aviso "s/ atrib." em campanhas antigas (pré-atribuição, `leads_nossos=0`).
- **Marketplace**: tendência por canal (ML Battogo/Bononi/Full/Shopee), faturamento **LÍQUIDO de devolução** (25/08), pedidos, ticket, Δ R$/% vs período anterior, sparkline 6m, barra empilhada, coluna Devolução. (Removida toda a gestão de estoque ML Full.)
- **Vendedores**: ranking **por líquido** (26/08, devolução por `id_vendedor`), KPIs bruto→devolução→líquido.
- **Relatórios**: agrupamento produto/vendedor/mês com filtros amplos (canal/vendedor/grupo/subgrupo/produto), **líquido por linha** (26/08, devolução respeitando os mesmos filtros das vendas), export CSV.
- **Atendimento**: funil de vendedores (`FunilVendedores.tsx`) com nova coluna **Faturamento (R$)** por vendedor (26/08, `valor_venda_erp` de `ecom_atd_funil`); KPI "Vendedores ativos" agora lê `vw_ecom_vendedores_ativos` (fonte = Hub, Config→Umbler→Usuários — o ecom só lê, não cadastra); mapa de calor 24h; TMR via `vw_ecom_tempo_resposta` (mediana, fonte `umbler_mensagens`).
- **Devolução externa** (25–26/08): `vw_ecom_devolucao_externa` amarra devolução→venda ONLINE (`interna=false`), traz `id_vendedor`/`subgrupo`. Aplicada em Home, Marketplace, Vendedores e Relatórios. Detalhe completo na doc do app.

## Correção de base (26/08/2026) — "faturamento do site sumido"
**Não era bug de render** (a Home já tinha o card "Faturamento Site"). A plataforma migrou de `SITE` pra `TRAY` (Tray Commerce) entre abr–jul/26; `SITE` zerou e `TRAY` virou 100% do canal, mas `getCanal()` não reconhecia `TRAY` e jogava tudo pro bucket "vendedor" (inflando o ranking de vendedores e zerando o site). Fix: `SITE_NAMES` em `src/lib/query.ts` agora inclui `'TRAY'`. Corrige de uma vez Home, Vendedores, Marketplace e Relatórios (todos usam o mesmo `getCanal()`).

## Pendências / próximos passos
- [ ] **Margem líquida do marketplace (frete+taxas) — BLOQUEADA em achar a tabela certa.** Leo pediu pra descontar frete+comissão do card "Faturamento Marketplace". `vw_comercial_docs_faturados` já tem `taxa_marketplace`/`valor_frete`, mas funciona só pro ML (Shopee tem `taxa_marketplace=0`, gap de dado). O Leo mandou print do ERP com "FRETE E-COMMERCE PGTO"/"COMISSAO E-COMMERCE" (código ~164486+) — confirmado Firebird antigo, mas não é `TBL_MOVIMENTO` (não bate com `vw_fb_movimento_base`, que só vai até cod_movimento 114329). Falta achar a tabela certa e escrever extração nova no `bononi-replicador`. Detalhe completo em `docs/ESTADO_ATUAL_APP.md`.
- [ ] **Mover OFICIAL LV/LF pra Aplicação "GERAL SUPABASE"** na UI da Umbler e remover o webhook dedicado antigo (só o Leo faz). Enquanto coexistir = entrega dupla (não quebra).
- [ ] Otimizar `vw_ecom_campanha_conversao` (500 intermitente por timeout; com filtro `mes_ref` responde 200) — usada pelo pipeline antigo de Marketing, não pela nova aba ROI.
- [ ] Se o Leo quiser, aplicar líquido de devolução também no gráfico 6m por vendedor (Home/Vendedores) e no pivô de produtos (Marketplace) — hoje ficam brutos de propósito.

## Dívidas e armadilhas conhecidas
- **Bundle antigo em cache no navegador** foi a causa real de vários "bugs" que o Leo viu (Home em branco, #id/produtos vazios) — **hard refresh / redeploy** resolve; as queries e CORS estão OK.
- TMR antiga (`vw_ecom_espera_vendedor`, filtro `etapa='ECOMMERCE...'`) **morreu na migração Umbler** — não usar; casar por telefone dá tempos absurdos.
- Tabelas `ecom_umbler_conversas/mensagens` e `ecom_debug_webhook` (1,4 GB) foram dropadas/truncadas — o raw agora é `umbler_eventos.payload`.

## Dev-log
- 2026-08-26 (tarde) — **ROAS/CAC corrigido** (base pedida pelo Leo: tráfego alimenta site+vendedores, não só campanha atribuída) — em produção. **Margem marketplace investigada e BLOQUEADA** (ver Pendências acima) — não mexi no card "Faturamento Marketplace", continua bruto.
- 2026-08-26 — **Comandos do cérebro (4 itens)**: (1) nova aba `/campanhas-roi` (fonte `vw_ecom_campanha_roi`); (2) fix `SITE_NAMES` inclui `TRAY` — resolve "site sumido" de vez, Home ganhou ROAS geral/CAC/Ticket médio; (3) "Vendedores ativos" lê `vw_ecom_vendedores_ativos` (Hub); (4) coluna Faturamento (R$) no funil via `valor_venda_erp`. Também: devolução externa estendida pra Vendedores (ranking por líquido) e Relatórios (líquido por linha, respeitando filtros); view `vw_ecom_devolucao_externa` ganhou `subgrupo`.
- 2026-08-25 — **Marketplace líquido de devolução por canal** (PR #1, mergeado). `use-marketplace.ts`: `aggMktDev` lê `vw_ecom_devolucao_externa` e abate por canal (mesma classificação `getCanal`/`normMkt` do faturamento); série 6m neta com devolução como fat negativo. `Marketplace.tsx`: coluna Devolução + KPI "Total Marketplace (líq.)". Tabela de produtos fica bruta (mix/volume). Só externa abate; atribuição = mês da devolução. Validado ao vivo (jul: ML Battogo 170k, Full 91k, Bononi 141k, Shopee 78k). Home/Vendedores já netavam.
- 2026-08-07 — TMR revivida (`vw_ecom_tempo_resposta*`, mediana); lote Atendimento/Relatórios/Vendedores.
- 2026-08-06 — Remodela: Marketplace por canal, comparativos + aviso de mês parcial, TMR removida do ranking.
- 2026-07-31 — Migração pro intake único (`Ecomm_UMBLER` v83); funil repontado p/ `bononi_telefone_key`; conversão +15 vendas/+R$86k.
