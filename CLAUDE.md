# E-commerce Stonni (bononiecommerce) — guia do projeto

> **Estado atual, pendências e dev-log: `docs/STATUS.md`.** Este arquivo é só o que é estável.
> Contexto do grupo e regras de banco: skill `bononi-contexto`. Rodar local: `rodar-app`.
> Publicar: `publicar-e-conferir`. Registrar o que foi feito: `registrar-status`.

## O que é

Dashboard do **e-commerce Stonni**: faturamento por canal, marketing (Meta Ads), marketplace
(Mercado Livre / Shopee), atendimento (funil e tempo de resposta) e relatórios.

## Onde está

- **Clone nesta máquina (`ecommerce06`):** `C:\Aplicações da bononi\bononiecommerce`.
  Na máquina do Leo o código fica em `...\bononiecommerce\temp_clone` — a raiz lá é wrapper.
- **Remote:** `leobononi2906/bononiecommerce`, branch `main`. **`git fetch` antes de trabalhar** —
  já houve sessão paralela commitando na `main`.
- **Deploy:** https://bononiecommerce.vercel.app
- **Supabase:** `vishxwdxqiygbxmtpfoy` (+ Meta CAPI — ver `docs/META_CAPI_E_RELATORIOS.md`).
- **Local:** `preview_start { name: "ecommerce" }` → porta 5180.

## Stack

React + Vite 5 + TypeScript + Tailwind + recharts + `@supabase/supabase-js`. O `package.json` se
chama `stonni-dashboard` (nome antigo) — não confundir com outro app.

## Armadilhas deste repo

- **O `.env` deste clone aponta para o banco de TESTE (`gxzhuewczlixksqrmjuk`)** — é o que o
  `npm run dev` usa. Não suponha que o publicado use o mesmo banco.
- **App de baixo uso, com autorização explícita para "mandar bala"** — quebrar aqui não é
  problema grave. **Isso não vale para o atacado nem para nenhum outro app do grupo**, e é a
  única exceção registrada; fora deste repo, a regra normal volta a valer.
- **Gráfico com token de cor não funciona**: biblioteca que desenha em canvas descarta `var()` e
  pinta transparente, sem erro. Resolva a cor em runtime.
- Números de faturamento: **deduplicar antes de agregar** qualquer view comercial (elas vêm com
  `UNION ALL`) e **separar venda interna do grupo** da venda a cliente de fora — misturar infla o
  resultado.
