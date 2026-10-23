# Engenharia reversa do Tintim — 23/10/2026

Levantamento feito navegando o painel do Tintim (`s.tintim.app`, conta "Acessorios bononi", login do Kauan) só em leitura, sem criar, mover ou salvar nada. O objetivo é ter uma ferramenta própria igual e trocar a Compra do Tintim pelo nosso CAPI (memória `capi-substitui-tintim`, `META_CAPI_E_RELATORIOS.md` §7).

Nenhum telefone ou nome de lead foi copiado para cá.

## 1. Como o Tintim funciona, em uma frase

Ele recebe as conversas do WhatsApp 44 9 8802-1660 (conexão por "integration-request", ou seja, por um provedor e não por QR), descobre de qual anúncio cada conversa veio, guarda o lead numa **etapa da jornada** e, a cada mudança de etapa, manda um evento ao Meta pela API de Conversões no **PIXEL TINTIM** (`1943741369503969`).

## 2. Como ele descobre o anúncio ("mensagem rastreável")

- Em **Campanhas de Mensagem** ele lista cada campanha → conjunto → anúncio do Meta, com a mensagem pré-preenchida que o anúncio manda ("Quero saber do Ar condicionado elétrico para caminhão"). A situação de cada um é "Aguardando Publicação" ou "Publicado".
- A mensagem que ele gera tem **caracteres invisíveis** (largura zero) no meio do texto, que codificam o anúncio. Exemplo visto na ficha de um lead: `confo﻿‌​‌​​​‌⁠‌‌‌‌​‌﻿rto`. Alguém (o Kauan) cola essa mensagem no modelo do anúncio. Quando o cliente clica e manda a mensagem, o Tintim lê os caracteres e sabe o anúncio.
- A ficha do lead guarda: método de rastreio, mensagem inicial, conta de anúncio, campanha, conjunto e anúncio.
- **Nós já temos isso sem truque:** a `umbler_lead_origem` traz o `ad_id` do referral do Meta em 100% dos leads (§1 do doc do CAPI), e a `meta_ad_cache` resolve os nomes.

## 3. Jornada de compra (etapas → evento do Meta)

| ID | Etapa | Marcação | Evento enviado ao Meta |
|---|---|---|---|
| 82360 | NOVO CONTATO | Primeiro Contato | Contact |
| 154170 | EM ATENDIMENTO | — | Lead |
| 82389 | EM NEGOCIAÇÃO | — | InitiateCheckout |
| 82361 | COMPRA | Venda | **Purchase** |
| 154337 | SEM RESPOSTA | — | SubmitApplication |
| 154171 | DESQUALIFICADO | — | ViewContent |
| 154973 | JÁ É CLIENTE | — | nenhum |

"SEM RESPOSTA" e "DESQUALIFICADO" usam eventos padrão do Meta como se fossem rótulos (SubmitApplication, ViewContent). Isso é gambiarra: o Meta pode otimizar por esses eventos achando que são outra coisa.

**Formulário de etapa** (Jornada de Compra → nova etapa) tem estes campos:
- nome;
- evento de conversão (lista dos 17 eventos padrão do Meta, ou vazio para não disparar);
- "Etapa que representa uma venda?" + **"Valor padrão da Venda em R$"**: o valor da compra é **fixo por etapa**, não o valor real do pedido;
- "Etapa que representa um primeiro contato?";
- **"Termo-chave para alterar esta etapa"**: quando o **atendente** digita esse termo na conversa, o Tintim muda a etapa sozinho. No histórico do lead aparece como "Automático — Fez Contato".

A etapa também pode ser trocada à mão na lista de conversas (lista ou kanban, um por um ou "Alterar Etapa em Lote").

## 4. O que vai ao Meta (payload real, visto em "Disparos de Eventos")

```python
{'action_source': 'chat',
 'custom_data': {},                # na Compra: currency BRL + value
 'event_name': 'InitiateCheckout',
 'event_time': 1789127750,
 'user_data': {'external_id': '<sha256>',
               'fn': '<sha256 do primeiro nome>',
               'ge': '<sha256 do gênero, deduzido do nome>',
               'ph': '<sha256 do telefone>'}}
```

- `action_source: 'chat'`: é por isso que o pixel não precisa estar ligado ao WhatsApp.
- Nesse disparo **não havia `ctwa_clid`** (o lead era de março). A atribuição se apoia no telefone com hash. A FAQ diz que manda o `ctwa_clid` quando existe.
- "Disparos de Eventos" mostra os últimos 50, com retorno (Sucesso/erro) e o payload de cada um.
- Configuração da conta: pixel `1943741369503969`, **"Disparar Pixel para conversas não rastreadas: Sim"** (manda evento até de conversa sem anúncio) e um token da API de Conversões guardado no painel (visível na tela "Informações do Cliente"; não foi copiado). Contas de anúncio associadas: Bononi - Ecommerce, Bononi - Contingência, Bononi Acessórios - Vendas Oline.

## 5. As outras telas

- **Dashboard:** conversas aguardando 1ª resposta (18.662), tempo médio de jornada (1 mês e 9 dias), conversas novas no período (1.454, sendo 83% rastreadas), tempo médio de 1ª resposta (com opção de ignorar a saudação automática), origem (Meta Ads, Google Ads, outras, não rastreada), funil por data do 1º contato ou da venda, total de vendas e faturamento.
- **Conversas:** lista e kanban, busca por telefone ou nome, filtros salvos e avançados, ordenar por 1ª/última mensagem, origem e etapa, exportar, "Visualizar conversa" (o Tintim guarda as mensagens).
- **Inspetor de Vendas (LUPA IA, beta):** uma IA lê as conversas e sugere "possíveis vendas" com a mensagem de evidência e um nível de confiança, para alguém aprovar ou reprovar. Limite de 500 conversas por mês. As evidências vistas eram fracas ("Blz", "Brigado", "Bom dia meu Rei"). **Nós não precisamos disso: temos a venda real do SGA casada pelo telefone.**
- **Inspetor de Campanhas, Links Rastreáveis, Mensagens Rastreáveis (Google):** rastreio para outras origens (Google Ads está desconectado).
- **Webhooks:** quatro gatilhos (criação de conversa, alteração de conversa, criação de mensagem, alteração de origem). O único endereço (Make) foi desativado por erro desde 15/04/2026.
- **Relatórios:** `data-leads` e `sales-history`.

## 6. O que falta para a ferramenta própria

| Peça do Tintim | O que já temos | O que falta |
|---|---|---|
| Origem do anúncio | `umbler_lead_origem` + `meta_ad_cache` (100% com `ad_id`) | — |
| Conversas | Umbler (mensagens) | tela de lista e kanban |
| Etapas da jornada | `ecom_atd_funil` (funil do atendimento) | tabela de etapas com evento associado + histórico de mudança |
| Mudança de etapa | — | regra automática (termo-chave do atendente, ou derivar da própria Umbler/SGA) + troca manual |
| Venda | **venda real do SGA** (`vw_capi_pendentes`, com valor) | — (melhor que o Tintim: valor real, sem depender de etapa) |
| Envio ao Meta | `meta-capi-simular` + fila `meta_capi_eventos` | mudar para `action_source: 'chat'` + `ph`/`external_id` com hash, e mandar também Contact/Lead/InitiateCheckout se quisermos manter o que as campanhas usam |
| Dashboard | telas do bononiecommerce (Leads, Campanhas, ROAS) | aguardando 1ª resposta, tempo de 1ª resposta, % rastreada |

**Antes de desligar o Tintim:** a Compra do PIXEL TINTIM é usada por **16 conjuntos de anúncios ativos** para otimizar. Contact e Lead (3,9 mil cada) também podem estar sendo usados. A troca tem de manter os mesmos nomes de evento no mesmo pixel, e só um dos dois sistemas pode mandar cada evento.
