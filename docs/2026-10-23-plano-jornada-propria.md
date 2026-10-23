# Plano — jornada própria no lugar do Tintim (23/10/2026)

## Modelo e esforço ideais (para executar este plano)
- **Fases 0, 1 e 2 (medir, banco, envio ao Meta): Opus 5.5 · esforço medium.** São arquitetura nova, banco de produção e o sinal que 16 conjuntos de anúncios usam para gastar dinheiro. Errar aqui custa caro e é difícil de desfazer.
- **Fases 3 e 4 (telas e dashboard): Sonnet 5.5 · esforço medium.** É tela em app de baixo uso, com autorização para "mandar bala" (CLAUDE.md do bononiecommerce).
- **Fase 5 (virada): Opus 5.5 · medium.** É a hora em que se desliga um e liga o outro.

Esta sessão está em Opus. Para as fases 3 e 4 dá para trocar para Sonnet no seletor.

## Contexto
O Tintim (levantamento em `2026-10-23-engenharia-reversa-tintim.md`) faz quatro coisas:
1. descobre o anúncio de cada conversa;
2. guarda o lead numa etapa da jornada;
3. muda a etapa à mão ou por termo-chave digitado pelo atendente;
4. a cada etapa, manda um evento ao Meta no PIXEL TINTIM (`action_source: chat`).

A Compra que ele manda é usada por 16 conjuntos de anúncios ativos, mas cobre só ~1/4 das vendas e com valor fixo.

**O banco já tem quase todos os ingredientes** (medido em 23/10):

| Ingrediente | Onde | Estado |
|---|---|---|
| Anúncio de origem | `umbler_lead_origem` (12,1 mil telefones, **10,6 mil com `ctwa_clid`**) + `meta_ad_cache` | ao vivo |
| Eventos da Umbler | `umbler_eventos`: Message 40,7 mil, NewChat 2,4 mil, ChatTagChanged 999, ChatClosed, MemberTransfer… nos últimos 7 dias | ao vivo (webhook) |
| Conversas | `umbler_conversas` (21,8 mil, com atendente e tags) | ao vivo |
| Mensagens com texto | `umbler_msg` (53 mil) | **parada desde 17/08/2026**. Hoje o texto está só no `payload` de `umbler_eventos` |
| Funil por etiqueta | `ecom_atd_funil` (40,8 mil) + `ecom_atd_config_etiqueta`: INTERESSADO, DESISTIU, DESQUALIFICADO e EQUIPE (=fechou), por prefixo da tag da Umbler | ao vivo |
| Venda real | `ecom_atd_funil.comprou_erp/valor_venda_erp` e `vw_capi_pendentes` (SGA, casado pelo telefone) | ao vivo |
| Fila e envio ao Meta | `meta_capi_eventos` + Edge Function `meta-capi-simular` (secrets prontos, token do "contato" válido) | pronto, falta o modo `chat` |
| Etapa do Tintim para comparar | `ecom_tintim_leads.status_nome` (cron job 8, de hora em hora) | ao vivo enquanto o Tintim existir |

## Decisão central: etapa automática, sem termo-chave
O Tintim depende de alguém mudar a etapa ou digitar um termo. A nossa etapa nasce do que **já acontece**: a conversa chega, o atendente responde, a tag da Umbler, a venda no SGA. A troca manual fica como exceção.

| Etapa | Entra quando | Evento ao Meta (mesmo nome do Tintim) |
|---|---|---|
| NOVO CONTATO | `NewChat` ou 1ª mensagem do cliente com origem de anúncio | Contact |
| EM ATENDIMENTO | 1ª resposta de um atendente (mensagem de membro) | Lead |
| EM NEGOCIAÇÃO | tag **INTERESSADO** na Umbler | InitiateCheckout |
| COMPRA | **venda no SGA** casada pelo telefone (valor real) | Purchase (`value` = valor da venda, BRL) |
| SEM RESPOSTA | tag **DESISTIU** (ou X dias sem resposta do cliente; a decidir) | SubmitApplication (só para não quebrar o que já existe; ver risco 3) |
| DESQUALIFICADO | tag **DESQUALIFICADO** | ViewContent (idem) |
| JÁ É CLIENTE | telefone com venda anterior no SGA | nenhum |

**A confirmar com o Kauan antes da Fase 1:** se essas tags são as que a equipe usa, e se ele quer manter SubmitApplication e ViewContent ou parar de mandá-los.

## Resultado da Fase 0 (23/10/2026, só leitura)
Consulta: `umbler_conversas` do canal **OFICIAL LV** abertas nos últimos 30 dias (uma por telefone, a mais recente) × `ecom_tintim_leads` atualizados nos últimos 30 dias. O cruzamento é pelo telefone normalizado (DDD + 8 últimos dígitos), e a venda vem de `ecom_atd_funil.comprou_erp`.

**As tags reais da Umbler** (30 dias, OFICIAL LV) são diferentes das que a configuração do funil procura: QUALIFICADO 3.384, **SEM RESPOSTA 2.239**, **INTERESSADO LV 987**, **DESQUALIFICADO LV 165**, NÃO RESPONDEU 77 e NOVO LEAD TINTIM 114. **DESISTIU não existe.** Também há tags de origem (META), de produto (CAMINHÃO, GERADOR, AR CONDICIONADO) e com o nome do vendedor.

**Regra testada** (a de cima vence): venda no SGA → COMPRA; tag DESQUALIFICADO* → DESQUALIFICADO; tag SEM RESPOSTA/NÃO RESPONDEU → SEM RESPOSTA; tag INTERESSADO* → EM NEGOCIAÇÃO; com atendente ou tag QUALIFICADO → EM ATENDIMENTO; senão, NOVO CONTATO.

**Concordância nos 3.354 telefones que estão nas duas bases: 81%** (2.706). A primeira versão, com INTERESSADO acima de SEM RESPOSTA, dava 70%.

| Etapa (nossa) | Iguais / nas duas bases | Onde diverge |
|---|---|---|
| EM ATENDIMENTO | 2.015 / 2.173 (93%) | 112 o Tintim já pôs em negociação (termo-chave digitado, sem tag) |
| DESQUALIFICADO | 53 / 73 (73%) | 13 o Tintim deixou em atendimento |
| SEM RESPOSTA | 565 / 882 (64%) | **177 o Tintim diz negociação**: o lead tem as duas tags, e vale a mais recente |
| EM NEGOCIAÇÃO | 53 / 169 (31%) | 106 o Tintim deixou em atendimento (tag INTERESSADO sem termo-chave no Tintim) |
| COMPRA | 20 / 56 | **36 vendas do SGA que o Tintim não marcou** (+3 fora dele) |

O que isso muda na Fase 1:
1. **A etapa precisa seguir a ordem no tempo, não só a tag atual.** `umbler_conversas.tags` é uma foto. A Fase 1 deve ler `ChatTagChanged` de `umbler_eventos` (com horário) para que a última tag vença. Só COMPRA e DESQUALIFICADO "travam".
2. **Compra pelo SGA confirmada como ganho:** 39 vendas a mais que o Tintim nos 30 dias. Ao contrário: **24 leads estão como COMPRA no Tintim sem venda no SGA**, e só 2 deles têm alguma venda em qualquer data com esse telefone. É preciso conferir com o Kauan se a compra saiu em outro telefone/CNPJ ou se foi marcada errada (lista fica no banco, não neste doc).
3. **A configuração `ecom_atd_config_etiqueta` está desatualizada** (procura DESISTIU e EQUIPE, que não aparecem). As etapas novas devem casar com as tags reais acima.

Limite da medição: **a cópia do Tintim no nosso banco está incompleta.** De 16 a 23/10 o painel do Tintim mostra 1.454 conversas novas, e `ecom_tintim_leads` tem 831 criadas no período (~57%). Por isso as 1.727 conversas "só nossas" (85% com anúncio identificado) **não** provam que o Tintim deixou de rastreá-las: provavelmente o cron job 8 não traz tudo. A concordância de 81% vale para os telefones que estão nas duas.

## Fases

### Fase 0 — Medir antes de construir (só leitura, ~meio dia)
Calcular a etapa "nossa" dos últimos 30 dias com as regras acima, em SQL, e cruzar com `ecom_tintim_leads.status_nome` por telefone:
- concordância por etapa;
- vendas que nós vemos e o Tintim não (já medido: 39 contra 10);
- leads que o Tintim rastreia e nós não.

**Pronto quando:** houver uma tabela de concordância e a lista de diferenças com o motivo de cada uma. Se a concordância das etapas de cima for ruim, ajustar a regra antes da Fase 1.

### Fase 1 — Banco (migration revisada; skill `aplicar-migration`)
**Estado em 23/10/2026: escrita e ensaiada em produção com rollback, sem aplicar.** Resultado e ordem estão em `2026-10-23-REVISAO-ecom-jornada.md`: 5.629 leads, 79 compras (R$ 482 mil), 71% de concordância com o Tintim, 25 s para 30 dias.
- `ecom_jornada_etapa`: configuração (nome, ordem, evento do Meta, é venda?, é 1º contato?, regra de entrada). Nasce com as 7 linhas da tabela acima.
- `ecom_jornada_lead`: um registro por telefone (`chave_tel`), com etapa atual, origem (`ad_id`, `ctwa_clid`, campanha), 1ª mensagem, 1ª resposta, última mensagem e venda.
- `ecom_jornada_historico`: de → para, motivo (`automatico`/`manual`/`sga`), quem, quando. Cada linha é um evento candidato ao Meta.
- Função `ecom_jornada_processar()` que lê o que chegou desde a última rodada (`umbler_eventos`, `umbler_lead_origem`, `ecom_atd_funil`, vendas) e avança as etapas **só para frente**: compra não volta para negociação. Agendada por cron a cada 10 min, com prova da rodada e não só do "succeeded" (memória `cron-succeeded-nao-e-funcao-ok`).
- RLS ligado em tudo, e leitura só para quem tem o módulo do e-commerce.

**Pronto quando:** o ensaio em produção (com rollback) preencher a jornada dos últimos 30 dias com os mesmos números da Fase 0.

### Fase 2 — Envio ao Meta (Edge Function; skill `publicar-edge-function`)
- Generalizar `meta_capi_eventos` para qualquer `event_name` vindo de `ecom_jornada_historico`, com `event_id = jornada-<id do histórico>` para o Meta deduplicar.
- Payload no formato que o Meta aceita no PIXEL TINTIM: `action_source: 'chat'`, `user_data` com `ph` e `external_id` em SHA-256 (mais `ctwa_clid` quando houver), e `custom_data` com `currency/value` só na Compra.
- Janela de 7 dias, teto por rodada e só 4xx vira erro: tudo isso já existe e se mantém.
- **Testar só no Test Events do PIXEL TINTIM** (falta o código de teste dele; pedir ao Kauan) com `META_CAPI_DATASET_ID=1943741369503969`.

**Pronto quando:** os 7 tipos de evento aparecerem no Test Events com a "qualidade da correspondência" comparável à do Tintim (4,8/10).

### Fase 3 — Telas no bononiecommerce
- **Jornada:** lista e kanban por etapa, filtros (origem, etapa, período, atendente) e busca por telefone ou nome.
- **Ficha do lead:** origem (campanha, conjunto, anúncio), histórico de etapas, venda do SGA e disparos ao Meta, com retorno.
- **Troca manual de etapa** (grava no histórico como `manual`, com quem fez).
- **Disparos:** os últimos N eventos com payload e retorno, igual ao "Disparos de Eventos" do Tintim.
- **Configuração das etapas** (só admin).

### Fase 4 — Indicadores do dashboard
Conversas aguardando 1ª resposta, tempo médio de 1ª resposta (com a opção de ignorar a saudação automática), % de conversas com anúncio identificado, funil por data do 1º contato e por data da venda, vendas e faturamento por campanha. Boa parte já existe nas telas de Leads e Campanhas.

### Fase 5 — Virada (combinada com o Kauan, num horário marcado)
1. Rodar em paralelo, mandando só para o Test Events, por ~7 dias. Comparar o volume por evento com o do Tintim no Gerenciador de Eventos.
2. No mesmo horário: o Kauan **tira o evento de cada etapa no Tintim** (campo "Evento de Conversão" vazio) e nós tiramos o `META_CAPI_TEST_CODE`.
3. Acompanhar por 7 dias, no Gerenciador de Eventos do PIXEL TINTIM, os 16 conjuntos que usam a Compra: volume, qualidade da correspondência, avisos.
4. Depois disso: cancelar o Tintim, pausar o job 8 (`ecom-tintim-syn`) e registrar.

## Riscos
1. **Evento duplicado na virada:** cada evento tem de ter um único dono no mesmo instante, por isso o passo 2 da Fase 5 é feito no mesmo horário.
2. **Aprendizado das campanhas:** trocar quem manda a Compra pode mexer na otimização dos 16 conjuntos por alguns dias. Virar fora de pico de verba (não na Black Friday).
3. **SubmitApplication e ViewContent usados como rótulo:** se algum conjunto otimiza por eles, mudar o sentido afeta esse conjunto. Conferir no Gerenciador de Eventos ("Usado por") antes de decidir.
4. **Disciplina das tags na Umbler:** a regra depende das tags INTERESSADO, DESISTIU e DESQUALIFICADO. Medir na Fase 0 quantas conversas recebem tag.
5. **`umbler_msg` parada desde 17/08:** a Fase 1 lê de `umbler_eventos`. Se o texto da mensagem for necessário, reativar ou substituir a gravação.
6. **Conta do WhatsApp com alerta de "envio de spam"** no Gerenciador do WhatsApp: não é deste projeto, mas pode derrubar a origem de tudo.

## Fora do escopo
Inspetor de Vendas por IA (temos a venda real), mensagem rastreável com caracteres invisíveis (a Umbler entrega o referral com `ctwa_clid`), Google Ads, webhooks para Make.
