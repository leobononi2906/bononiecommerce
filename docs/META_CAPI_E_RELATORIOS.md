# Meta — Atribuição, Relatórios de Campanha e CAPI

> Documento de handoff. Explica **de onde vem** cada número de campanha do ecommerce, **como puxar** os relatórios, **como ler** a conversão sem errar, e o estado do **CAPI** (retorno de conversão pra Meta).
> Última atualização: **01/09/2026**. Banco: Supabase `vishxwdxqiygbxmtpfoy`, schema `public`.

---

## 1. O ciclo que estamos medindo

```
Anúncio Meta (Click-to-WhatsApp) → Lead entra na Umbler → Atendimento → Venda no ERP → R$
```

O objetivo é fechar esse ciclo com dado próprio (sem depender de ferramenta paga) e, no fim, **devolver a conversão pra Meta via CAPI** pra ela otimizar os anúncios sozinha.

---

## 2. As fontes de dados (tabelas) — o que é cada uma

| Tabela | O que guarda | De onde vem |
|---|---|---|
| `umbler_lead_origem` | 1 linha por telefone: `ad_id`, `ctwa_clid`, título do anúncio, canal, 1º evento | Payload da Umbler (só canais **OFICIAIS**), cron `meta-atribuicao-refresh` |
| `meta_ad_cache` | `ad_id` → `ad_name`, `adset_name`, `campaign_name` | Graph API da Meta, cron `meta-resolver-ad` |
| `ecom_meta_ads` | Custo por campanha/dia: investimento, cliques, impressões, leads | Sync Meta (`ecom-meta-sync`) |
| `ecom_atd_funil` | Funil lead↔venda: `chave_tel`, `comprou_erp`, `valor_venda_erp`, vendedor | Cron `ecom_atd_refresh` (casa telefone com ERP) |
| `ecom_tintim_leads` | Leads do **Tintim** (ferramenta paga, a desligar): campanha/conjunto/anúncio/status | Cron `ecom-tintim-syn` (job 8) |
| `ecom_pedidos` | Pedidos do site | Intake do site |

**Chave de casamento telefone:** função `bononi_telefone_key(telefone)` — normaliza pra casar lead com venda. Sempre usar ela, nunca comparar telefone cru.

**`ctwa_clid`** = id único do clique no anúncio. É o que permite atribuição **determinística** (não é "achismo por telefone") e é o que o CAPI precisa pra devolver a conversão. Temos em ~3.351/3.653 leads (01/09).

---

## 3. As views de relatório de campanha — fontes e o repoint de 01/09

| View | Fonte dos leads (a partir de 01/09) | Serve pra |
|---|---|---|
| `vw_ecom_campanha_conversao` | **Nossa** (ago/26→) + Tintim congelado (histórico) | Campanhas por mês: leads, vendas, % conversão, faturamento, ticket |
| `vw_ecom_campanha_detalhe` | **Nossa** (ago/26→) + Tintim congelado (histórico) | Quebra por conjunto/anúncio dentro da campanha |
| `vw_ecom_campanha_roi` | **Nossa** (`umbler_lead_origem`+`meta_ad_cache`+`ecom_atd_funil`) | Campanhas 60d COM investimento, CPL e **ROAS** |

**Repoint feito em 01/09/2026** (migrations `repoint_vw_ecom_campanha_conversao/detalhe_para_base_propria`): as duas views de relatório saíram do Tintim. A partir de **agosto/2026** leem da nossa base própria (`umbler_lead_origem` + `meta_ad_cache`; venda via `ecom_pedidos`; "interessados" via tag `INTERESSADO%` em `ecom_atd_funil`). Os **meses anteriores** continuam vindo do Tintim **congelado** — a tabela `ecom_tintim_leads` não é apagada quando o job 8 parar, então o histórico fica preservado. Colunas e permissões idênticas (o app não quebra).

**Consequência (importante):** os números por campanha **rebasearam**. A nossa base é mais completa (agosto: **3.424 leads** contra 2.122 do Tintim) e conta **first-touch com dedup** — cada telefone conta **uma vez**, na primeira campanha que o trouxe. O Tintim contava **per-touch** (o mesmo telefone em toda campanha que tocou). Nenhum está "errado"; a nossa não infla lead repetido.

**Diferença de denominador entre as views (não estranhar):**
- `_conversao`/`_detalhe` contam como "venda" o lead com **pedido no site** (`ecom_pedidos`).
- `_roi` conta como "comprou" o lead com **venda no ERP** (`ecom_atd_funil.comprou_erp`).

**Todas as views já saíram do Tintim (01/09):** além das duas de campanha, foram repontadas:
- `vw_ecom_origem_leads` (tela de Leads, `use-leads.ts`) — nossa base ago/26→ + Tintim congelado no histórico.
- `ecom_campanhas_custos` (view **órfã**, nenhuma tela usa) — 100% nossa base, custo pré-somado por campanha (corrige uma inflação que existia no original).

**Estado final:** nenhuma view depende do Tintim para **dado novo**. As três que ainda referenciam `ecom_tintim_leads` (`_conversao`, `_detalhe`, `_origem_leads`) só a usam como **arquivo histórico congelado** (meses < ago/26). **Pode pausar o job 8 e cancelar a assinatura do Tintim sem quebrar nada.**

---

## 4. Como puxar "campanhas por leads e por conversão" (o pedido do Leo, 01/09)

View: **`vw_ecom_campanha_conversao`**. Filtra por mês em `mes_ref` (sempre o dia 1º do mês).

```sql
-- Campanhas de AGOSTO/2026, ranqueadas por volume de leads
SELECT campanha, leads, vendas, conversao_perc, faturamento, ticket_medio
FROM   vw_ecom_campanha_conversao
WHERE  mes_ref = date '2026-08-01'
ORDER BY leads DESC;
```

- Quer **com investimento e ROAS** ao lado? → `vw_ecom_campanha_roi` (janela fixa de 60 dias, não filtra por mês).
- Quer **abrir por anúncio** dentro da campanha? → `vw_ecom_campanha_detalhe` (mesmos campos + `conjunto`, `anuncio`).

Campos de `vw_ecom_campanha_conversao`: `campanha, mes_ref, leads, interessados, vendas, faturamento, conversao_perc, ticket_medio`.

---

## 5. ⚠️ REGRA DE LEITURA — a conversão é um PISO, não o número final

Não condenar campanha olhando só a % de conversão do mês corrente. Dois motivos:

1. **Defasagem de tempo.** Ciclo de venda de ar-condicionado/gerador é longo (orçamento → visita → fechamento). Campanha que subiu no **fim do mês** (as `[ESCALA]`) teve o lead entrando agora, mas a venda fecha em setembro/outubro. Então **0 venda hoje não é fracasso — é cedo.** As campanhas de fim de mês são pra **vigiar no mês seguinte**, não matar.
2. **"Venda" = telefone casado com nota no ERP.** Quem pagou com o telefone de outra pessoa, ou está em negociação sem nota emitida, ainda não conta.

**Exemplo real (agosto/2026, base própria):** 3.424 leads, 15 vendas casadas (~0,4%) — mas as 3 maiores campanhas de leads eram `[17/08][ESCALA]` recém-subidas, ainda em ciclo. As melhores taxas vieram de **COMBO** e **AR condicionado** (não gerador puro).

**Faturamento** nessas views = total do cliente no ERP no período = **direcional**, não valor exato ao centavo. Serve pra comparar campanha com campanha, não pra bater com o financeiro.

---

## 6. Tintim — o que é e o plano de desligar

`ecom-tintim-syn` (cron **"Sync Tintim Hourly", job 8, AINDA ATIVO**) puxa leads da API do Tintim (ferramenta **paga**) pra `ecom_tintim_leads`. Nossos nomes de campanha **batem 100%** com os do Tintim (validado).

**Plano:** rodar a atribuição própria em paralelo, e quando estiver confiante, pausar o job 8 e cancelar o Tintim.

**Status (01/09/2026): PRONTO pra desligar.**
- ✅ Todas as views repontadas pra base própria: `vw_ecom_campanha_conversao`, `vw_ecom_campanha_detalhe`, `vw_ecom_origem_leads`, `ecom_campanhas_custos` (ver seção 3).
- ✅ Nenhuma view depende do Tintim pra dado novo — só usam a tabela como histórico congelado.
- **Pode pausar o job 8 e cancelar a assinatura.** Pausar o job **não apaga** `ecom_tintim_leads`; o histórico anterior a ago/26 continua servindo os relatórios.
- (Opcional) Depois de cancelar, dá pra parar de sincronizar sem pressa; se um dia quiser limpar de vez, aí sim seria remover a dependência histórica das 3 views.

---

## 7. CAPI — devolver a conversão pra Meta

**O que é:** mandar de volta pra Meta o evento "esse lead comprou" (com valor R$ e `ctwa_clid`), pra ela otimizar os anúncios pelos que realmente vendem, não só pelos que geram lead.

**Decisão (01/09/2026): 100% IN-HOUSE.** Edge Function do Supabase → Meta direto, **sem intermediário** (Make/Zapier/Stape descartados — só somariam mensalidade e ponto de falha; a "cola" já é o próprio Supabase).

**Fluxo planejado:**
```
Venda cai no banco → função cruza o telefone com umbler_lead_origem
  → se foi lead de anúncio, dispara evento "Compra" (valor R$ + ctwa_clid) pro Meta
```
- `action_source: business_messaging` + `user_data.ctwa_clid`, janela de atribuição ~7 dias.
- Validar no **Test Events** do Meta antes de ligar de verdade.

**O que falta (pedido ao Kauan em 01/09):**
1. **`DATASET_ID`** do conjunto de dados do CTWA (no Meta Business Manager → "Conjuntos de dados").
2. **Token de ENVIO** com permissão `ads_management`. O token atual (`META_ACCESS_TOKEN`) é só de **leitura** — não serve pra enviar evento.

**✅ Modo simulação JÁ CONSTRUÍDO (01/09):**
- **Edge Function `meta-capi-simular`** — cruza vendas atribuídas a anúncio (via `vw_capi_pendentes`), monta o evento `Purchase` (valor R$ + `ctwa_clid`, `action_source: business_messaging`) e grava em **`meta_capi_eventos`** com `status='simulado'`. **NÃO dispara nada** por padrão. Idempotente (constraint `chave_tel+event_name+event_time`). Rodada 01/09: 24 eventos simulados, R$153k.
- Parâmetro opcional `?dias=N` (janela; padrão 30).

**Como LIGAR o envio real (quando o Kauan mandar as credenciais):**
1. Setar 3 secrets da Edge Function no Supabase: `META_CAPI_DATASET_ID`, `META_CAPI_TOKEN` (o de envio, `ads_management`), `META_CAPI_ENVIAR=true`.
2. (Recomendado 1º) Setar também `META_CAPI_TEST_CODE=<código do Test Events>` e rodar a função uma vez — os eventos aparecem na aba **Test Events** do Meta sem contar como conversão real. Validar lá.
3. Tirar o `META_CAPI_TEST_CODE` e agendar a função num cron (ex.: de hora em hora). Ela só envia eventos dos **últimos 7 dias** ainda `simulado`, e marca `enviado`/`erro` com a resposta do Meta em `meta_capi_eventos.resposta_meta`.

**Tabelas/objetos do CAPI:** `meta_capi_eventos` (fila+log dos eventos), `vw_capi_pendentes` (vendas atribuídas prontas pra virar evento).

Playbook técnico mais detalhado (texto passado ao dev): `C:\CLAUDE\Instrucoes\META_ATRIBUICAO_E_CONVERSOES.md`.

---

## 8. Crons relevantes

| Cron | Quando | Faz |
|---|---|---|
| `meta-atribuicao-refresh` | `15 * * * *` | Popula `umbler_lead_origem` (lead → anúncio) |
| `meta-resolver-ad` | `30 6 * * *` | Resolve campanha nova via Graph API (`meta_ad_cache`) |
| `ecom-meta-sync` | (sync custo) | Alimenta `ecom_meta_ads` (investimento) |
| `ecom_atd_refresh` | (existente) | Casa lead↔venda no `ecom_atd_funil` |
| `ecom-tintim-syn` | "Sync Tintim Hourly" (job 8) | Puxa Tintim — **a desligar** |

---

## 9. Estado dos dados (verificado 01/09/2026)

- 3.653 leads, **100% com `ad_id`**, 3.652 com nome de campanha; casam 100% com `meta_ad_cache` (73 anúncios, 22 campanhas).
- Custo em `ecom_meta_ads` até 31/08 (R$528k histórico).
- `ctwa_clid` presente em 3.351/3.653 leads.
- **Falha menor conhecida:** 2 campanhas `[FASE 3]...[29/06]` têm nome que não casa entre lead e custo (aparecem no volume mas sem investimento atrelado no ROI).
