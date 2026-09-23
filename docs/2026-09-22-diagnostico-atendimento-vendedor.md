# Diagnóstico — atendimento/conversão por vendedor (planilha manual x app)

> Origem: comparação entre `PLANILHA DE ATENDIMENTO - ECOM.xlsx` (controle manual, jan–set/2026,
> vendedores VITOR/FELIPE/GIULIANO/ALEX/GUILHERME/BLAS/HENRIQUE/MAYKEL/PEDRO, colunas Atend/Conv/Valor
> por dia) e o que o app `bononiecommerce` já automatiza hoje em `/atendimento` e `/vendedores`.
> Só leitura contra produção (`vishxwdxqiygbxmtpfoy`). **Nada foi aplicado.**

## 1. Resposta fechada: os 9 nomes da planilha

Não veio do banco — veio do próprio dev-log do app, **2026-09-18 (2)**, achado do Leo ao olhar o
ranking de Vendedores:

| Nome (planilha) | Status confirmado | Fonte |
|---|---|---|
| VITOR, ALEX, GIULIANO, MAYKEL, PEDRO | e-commerce ativo, vínculo Umbler↔ERP em `ecom_umbler_vendedor` | STATUS.md 18/09 (2) + conferido hoje no banco |
| **GUILHERME** | **é do atacado** — nome citado nominalmente pelo Leo | STATUS.md 18/09 (2) |
| **BLAS** | **já saiu da empresa** — era e-commerce (não é atacado), nome citado nominalmente | STATUS.md 18/09 (2) |
| FELIPE | não citado nominalmente nessa entrada, mas o rastro de WhatsApp dele é quase zero (11 leads em `ecom_leads`, mar–abr) contra os milhares da planilha em jan–mar — mesmo padrão de quem saiu cedo | inferência, não confirmada nominalmente |
| HENRIQUE | é o vendedor real (`Henrique Trombini`, ERP 7686) **com vínculo ativo** — não confundir com a pendência da linha 40 do STATUS.md, que fala de outro Henrique diferente (ver §2) | conferido hoje no banco |

**Correção em cima do que eu tinha dito antes:** eu tinha juntado GUILHERME e BLAS como "os dois
aparecem como atacado". Não é bem isso — GUILHERME é atacado, BLAS é ex-funcionário de e-commerce.
São dois motivos de exclusão diferentes, e para BLAS a planilha estava certa enquanto ele esteve
na empresa (mar–abr, exatamente a janela em que ele aparece nela).

## 2. `ecom_umbler_vendedor` não é uma tabela incompleta — é uma lista curada, e está funcionando

Cheguei a montar (e ensaiar, sem aplicar) um `INSERT` para vincular "Henrique Trombini"
(`aTGhkpoXrJLt7_rY`, ERP 7686), porque ele tem cadastro completo e ativo em `umbler_usuarios`
(fonte Hub) mas não estava em `ecom_umbler_vendedor`. **Descartei**: a pendência já registrada na
linha 40 do `STATUS.md` já tinha investigado esse exato ID antes e concluiu o oposto — 0 documentos
`ONLINE` em 6 meses, é atendimento de loja física/O.S., e vincular colocaria venda de balcão no
ranking de e-commerce. O mesmo vale para `aTG6AL5d9I0UBGsZ` ("Michael"). **Não propor de novo.**

Outros dois IDs grandes sem vínculo, que investiguei hoje e não estavam nessa pendência:

| ID Umbler | Nome (do próprio lead) | Leads | Janela | Provável motivo |
|---|---|---|---|---|
| `aSoSaIhJx343ITIY` | MATHEUS HENRIQUE SILVA FRAMESCHE | 3.392 | 24/02 – 16/07 | **ex-funcionário** — é o "Matheus F." citado na mesma entrada 18/09 (2) |
| `aXo1tqoSKCS1Xw7c` | KLEVERTTON HENRIQUE FERREIRA CAMARA | 1.354 | 18/03 – 05/07 | mesmo padrão (parou em julho, sem cadastro no Hub) — **não citado nominalmente**, tratar como provável, não confirmado |

Conclusão do item 2: **não há mapeamento pra corrigir.** A tabela está deliberadamente restrita a
quem é vendedor de e-commerce ativo agora. Isso fecha a pergunta original ("os 9 nomes estão no
SGA mas não no app") de outro jeito: o dado nunca teve que vir do SGA — ele já é filtrado e
automatizado a partir de Umbler+ERP, e o filtro está certo.

## 3. O que fica genuinamente aberto (isto sim precisa de decisão)

### A. `ecom_leads.convertido` nunca foi preenchido — 0 de 28.100 linhas

A coluna existe (`convertido boolean`, `convertido_em`, `id_venda`, `valor_venda`) mas nenhuma
linha tem qualquer uma delas preenchida. Hoje `vw_ecom_vendedores.convertidos` usa outra coisa —
conta nota fiscal `tipo_saida='ONLINE'` do vendedor no período, **não** "este atendimento virou
esta venda". Funciona como proxy de volume, mas não é a métrica "Conv" da planilha (que amarrava
o atendimento individual à venda).

Não é bug de dado pra corrigir com UPDATE — é ausência de lógica. Não tem `UPDATE` seguro que eu
possa propor aqui; quem preencheria isso é uma automação (Edge Function ou trigger) que hoje não
existe. **Decisão necessária:** vale construir essa amarração (nível de esforço: médio — precisa
casar telefone/contato do lead com documento do ERP dentro de uma janela de tempo), ou o proxy
atual (nota fiscal por vendedor) já é suficiente pro uso que o app tem hoje?

### B. `ecom_sdr_atendimentos` — causa isolada: o consumidor externo parou às 2026-09-09 13:25:27 UTC, e o dado bruto continua chegando normal desde então

Essa é a tabela mais parecida com a planilha de verdade: tem `outcome_final` (FECHOU/INTERESSADO/
EM_ANDAMENTO/DESQUALIFICADO/SEM_RESPOSTA/...) por atendimento individual — é o "Conv" da planilha,
granular. Cobre só 5 vendedores, e o pipeline por trás dela é uma cadeia de 9 tabelas
(`ecom_sdr_*`: `mensagens_norm` → `chat_rollup`/`seller_rollup` → `atendimentos`/`analises`,
mais `config`, `ingest_secret`, `audio_transcricoes`, `fechamentos_norm`, `transferencias_norm`).

**Descartado como causa:** o cron `ecom-atd-refresh` (jobid 45, roda de hora em hora, sempre
"succeeded") só escreve em `ecom_atd_funil` — nunca tocou essa cadeia. Conferi **os 44 cron jobs
do projeto inteiro, um por um**: nenhum referencia sdr, norm, ou qualquer tabela dessa cadeia.
Quem alimenta isso é 100% externo ao Postgres.

**Isolado com evidência, não suposição:**
- `ecom_sdr_config.norm_checkpoint` (o cursor da "normalização incremental de eventos Umbler")
  está travado em `2026-09-09T13:25:27` e não avançou 1 segundo desde então.
- `ecom_sdr_ingest_secret.active = true`, criado em 18/08 — **não é token revogado/expirado**.
- **O intake bruto do Umbler está saudável e atualizado até agora**: `umbler_eventos` tem
  **70.880 eventos recebidos depois desse checkpoint** (9.285 só nos últimos 2 dias, o mais
  recente às 12:25 de hoje). `ecom_leads` também segue recebendo lead normalmente até hoje.
- Ou seja: **o problema não é falta de dado — é um consumidor específico (o que normaliza
  evento Umbler pra dentro da cadeia `ecom_sdr_*`) que parou de rodar ou de conseguir ler.** Os
  70.880 eventos represados desde 09/09 continuam intactos em `umbler_eventos`, esperando —
  reprocessar não depende de recuperar dado nenhum, só de religar o consumidor.
- `ecom_sdr_analises` seguiu recebendo linha até **17/09** (8 dias depois do checkpoint travar) —
  compatível com uma fila que ainda tinha trabalho acumulado e foi drenando até esvaziar, não com
  uma segunda falha independente.

**O que não dá pra ver só com SQL:** onde esse consumidor roda de fato (Edge Function agendada
fora do `cron.job` do Postgres, VM externa, n8n, etc.) e por que parou às 13:25:27 daquele dia —
precisa de quem sabe onde esse processo vive, ou do painel do Supabase (Edge Functions → Logs,
filtrando por volta de 09/09 13:25 UTC).

## 4. Recomendação

Nenhuma ação de banco pendente — os itens 1 e 2 estão resolvidos e não precisam de SQL. Os dois
itens abertos (A e B) são decisão de produto/investigação de infra, não correção de dado:

1. **B primeiro** — é mais barato de checar (olhar Edge Functions/Logs no painel do Supabase por
   qualquer função com "sdr" ou "atendimento" no nome) e, se for só uma função caída, o conserto
   pode devolver a métrica de conversão real por atendimento sem precisar do item A.
2. **A depois, só se B não for suficiente** — construir a amarração lead→venda é o esforço maior;
   vale medir se o proxy atual (nota fiscal por vendedor) já resolve antes de investir nisso.
