# Stonni Ecommerce Dashboard

Dashboard de análise para o Grupo Bononi Acessórios — Stonni Ecommerce.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- Recharts (gráficos)
- Supabase (banco de dados)
- Lucide React (ícones)

## Páginas

| Página | Descrição |
|--------|-----------|
| Home | KPIs gerais, top subgrupos, top vendedores, faturamento 6 meses por vendedor e departamento |
| Atendimento | Leads Umbler, tempo médio de resposta individual e geral, funil, mapa de calor |
| Campanhas | Meta Ads, ROAS, CPL, CTR, ranking de campanhas, comparativo campanha × produto |
| Marketplace | Lucratividade por canal, ranking vendedores, taxa ~22% |
| Vendedores | TV mode, ranking com medalhas, alertas de tempo de resposta, auto-refresh 5min |
| Configurações | Vínculos Umbler ↔ ERP, campanha × subgrupo, metas, período padrão |

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Criar arquivo .env
cp .env.example .env
# Preencha VITE_SUPABASE_ANON_KEY com sua chave anônima do Supabase

# 3. Rodar em desenvolvimento
npm run dev
```

## Deploy no Vercel (via GitHub)

1. Faça push deste projeto para um repositório GitHub
2. Acesse https://vercel.com → Import Project → selecione o repositório
3. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL` = `https://vishxwdxqiygbxmtpfoy.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = sua chave anônima
4. Clique em Deploy

A partir daí, todo `git push` na branch `main` faz deploy automático.

## Supabase Project

- Project ID: `vishxwdxqiygbxmtpfoy`
- Views utilizadas: `vw_ecom_vendedores`, `vw_ecom_campanhas`, `vw_ecom_marketplace`, `vw_ecom_subgrupos`, `vw_ecom_atendimento`, `vw_ecom_espera_vendedor`, `vw_ecom_funil`
- Tabelas: `ecom_leads`, `ecom_meta_ads`, `ecom_umbler_vendedor`, `ecom_campanha_subgrupo`

## Regras importantes

- Taxa de conversão pode ultrapassar 100% — diferença de janela ERP vs Umbler (normal)
- `convertido` e `id_venda` em `ecom_leads` nunca são preenchidos automaticamente
- Views `vw_comercial_*` e `vw_dim_*` são somente leitura (replicadas do Firebird)
- Horário comercial: 08h–12h / 13h–18h
