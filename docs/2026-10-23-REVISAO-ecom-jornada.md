# Revisão — jornada própria, Fase 1 (23/10/2026)

Arquivos:
- `supabase/migrations/20261023120000_ecom_jornada.sql`: tabelas, funções e acesso;
- `supabase/migrations/20261023120100_ecom_jornada_cron.sql`: carga inicial de 30 dias e agendamento a cada 10 min.

Os dois estão em rascunho, **sem aplicar**. Plano completo em `2026-10-23-plano-jornada-propria.md`.

## Em quatro linhas
- **Cria:** 4 tabelas novas (`ecom_jornada_etapa`, `_lead`, `_historico`, `_controle`), 5 funções e 1 cron.
- **Altera:** nada que já existe. Só **lê** `umbler_eventos`, `umbler_lead_origem`, `ecom_atd_funil` e `ecom_jornada_*`.
- **Não apaga:** nenhum dado (auditoria abaixo).
- **Como volta:** `cron.unschedule` e `drop` das tabelas e funções novas (bloco REVERTER no fim do arquivo). Nada de fora depende delas.

## Por que agora
É a Fase 1 do plano para trocar a jornada do Tintim. A Compra do Tintim alimenta 16 conjuntos de anúncios, mas cobre ~1/4 das vendas e com valor fixo.

## Pré-voo (produção, só leitura)
- `ecom_jornada_*`, `ecom_chave_tel` e `ecom_jornada_pode_ler`: **não existem** (esperado, a migration cria).
- `ecom_leads_pode_ler()`: **não existe em produção** (a migration de 06/10 nunca foi aplicada). Por isso esta migration traz a própria `ecom_jornada_pode_ler()`.
- Índice por `recebido_em` em `umbler_eventos`: existe. `pg_cron`: instalado.
- `chave_tel` = DDD + 8 últimos dígitos: confere em 40.778 de 40.778 linhas da `ecom_atd_funil`.

## Ensaio em produção (begin … rollback), migration + carga de 30 dias
| Medida | Resultado |
|---|---|
| Tempo da carga de 30 dias | ~25 s (83 mil eventos da Umbler). A rodada de 10 min lê uma fração disso. |
| Leads criados | 5.629 (4.998 com anúncio identificado; **4.079 com `ctwa_clid`**) |
| Por etapa | NOVO CONTATO 173 · EM ATENDIMENTO 2.866 · EM NEGOCIAÇÃO 367 · COMPRA 79 · SEM RESPOSTA 2.065 · DESQUALIFICADO 55 · JÁ É CLIENTE 24 |
| Compras | 79 leads, **R$ 482.135** (venda real do SGA) |
| Histórico | 13.542 mudanças, todas como `historico` (não vão ao Meta) + 52 sem evento |
| 2ª rodada logo em seguida | 0 eventos, 0 mudanças (não duplica) |
| RLS | ligada nas 4 tabelas |
| Concordância com o Tintim | **2.894 de 4.074 (71%)** |

**Sobre os 71%:** o Tintim não é o gabarito, porque lá a etapa muda à mão ou por termo-chave. As divergências principais:
- **EM ATENDIMENTO × NOVO CONTATO (268):** o atendente já respondeu, mas o Tintim só muda quando ele digita o termo-chave. A nossa regra está certa por definição. Sem esses, a concordância vai a 78%.
- **SEM RESPOSTA × EM NEGOCIAÇÃO (234) e SEM RESPOSTA × EM ATENDIMENTO (193):** a etiqueta SEM RESPOSTA está na conversa, e o Tintim não a acompanhou.
- **EM ATENDIMENTO × EM NEGOCIAÇÃO (128) e o contrário (127):** a etiqueta INTERESSADO e o termo-chave do Tintim nem sempre andam juntos.

Três regras foram testadas no ensaio: prioridade sobre o conjunto de etiquetas = 71%, "a recém-adicionada vence" = 71%, "SEM RESPOSTA não tira da negociação" = 63%. Ficou a primeira.

**Achado do ensaio:** INTERESSADO LV e DESQUALIFICADO LV são etiquetas **do contato**, e SEM RESPOSTA e QUALIFICADO são **da conversa**. As do contato não geram `ChatTagChanged`, só aparecem dentro das mensagens. A primeira versão não as via (0 leads em negociação). A rotina agora lê as duas listas em todo evento.

## ⚠ O que muda no app que já está no ar quando aplicar
Nada. Nenhuma tela usa essas tabelas ainda. O cron só lê e grava nas tabelas novas.

## O que é escrito em produção
- Na aplicação: 7 linhas em `ecom_jornada_etapa` e 1 em `ecom_jornada_controle`.
- Na carga inicial (arquivo do cron): ~5,6 mil leads e ~13,6 mil linhas de histórico, todas `historico`/`sem_evento`. **Nada fica pendente para o Meta.**
- A cada 10 min: os leads e as mudanças novas, como `pendente`. Ninguém consome isso até a Fase 2.

## Não apaga dado — auditoria termo por termo
`grep -inE 'drop|delete|truncate|cascade'` na migration:
- `on delete restrict` (4×): FK que **impede** apagar.
- `drop table if exists _jornada_ev` e `on commit drop`: tabela **temporária** da própria rodada.
- `drop policy if exists` (3×): nas tabelas novas, para a migration poder rodar de novo.
- `revoke … delete, truncate …`: tira permissão, não apaga.
- O resto é o bloco REVERTER, comentado.

## Ordem para aplicar
1. `20261023120000_ecom_jornada.sql` (`sql.py prod … --escrever --producao`).
2. `20261023120100_ecom_jornada_cron.sql` (carga inicial + agendamento).
3. Conferir a 1ª rodada do cron **pelo resultado** (`ecom_jornada_controle.processado_ate` andando e leads novos), não pelo "succeeded".
4. Nenhum push de front nesta fase.

## Recomendação
Aplicar. É aditivo, isolado e reversível. Ainda não manda nada ao Meta, e começar a acumular a jornada agora deixa a Fase 2 e as telas com dado real.
