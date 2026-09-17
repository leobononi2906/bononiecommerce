# Design system aplicado — Stonni interno (17/09/2026)

## Por que Stonni interno, e não Bononi Acessórios

A tabela oficial da skill `aplicar-design-system` lista "E-commerce" na linha do design system
Bononi Acessórios (sistemas internos). Mas este app mostra a marca **Stonni** no sidebar e no
STATUS.md ("E-commerce Stonni (Dashboard)") — é o painel do produto Stonni, não uma ferramenta
operacional da Bononi Acessórios (tipo Expedição ou Compras). Perguntado ao Leo, a escolha foi
**Stonni interno** (`stonni-design-interno`), que é o pacote certo para ferramenta de gestão densa
em dado, não o site público (`stonni-design-externo`, que é escuro e não serve pra dashboard).

## O que mudou

**Cor de ação primária:** de azul genérico (`#0077CC`) para o azul da marca Stonni (`#1A74C4`,
`--action-primary-bg`). Cartões em destaque (highlight) trocaram de navy (`#1A3A8F`) para índigo
`#16103D` (`--indigo-900`) — o "cromo" da marca, mesmo tom usado na navegação lateral.

**Tipografia:** DM Sans/DM Mono → Archivo (títulos, valores de KPI) / IBM Plex Sans (corpo, UI) /
IBM Plex Mono (identificador, número tabular). Troca só de fonte — nenhum tamanho mudou nesta
passada (ver "O que ficou de fora").

**Emoji removido.** A regra do pacote é "emoji não é usado em sistema interno, nenhuma exceção":
- Os 3 banners de "mês em andamento" (Home, Marketplace, Campanhas) trocaram 📅 pelo ícone
  `Calendar` do `lucide-react` (já era dependência do projeto).
- O ranking de Vendedores trocava 🥇🥈🥉 por medalha — virou selo numerado com cor de destaque
  (`--feedback-warning-bg/fg` para 1º e 3º, `--surface-sunken` para 2º), sem depender só da cor:
  o número continua lá.

**Zero hex fora de `ds/`** (eram ~150, entre eles um gradiente com alfa manual em
`Vendedores.tsx` que virou `linear-gradient(var(--blue-50),var(--cyan-50))`) e **zero medida
literal fora da escala de 4px** nos arquivos CSS (11 em `index.css`: padding/gap/margin viraram
`--space-*`, tamanho de fonte do body virou `--fs-*`, raio de scrollbar virou `--radius-sm`).
Confirmado pelo `auditar-tokens.py` — as 5 checagens de falha silenciosa passaram.

## Onde estão os arquivos

| Arquivo | O que é |
|---|---|
| `src/ds/stonni-ds.css` | Tokens do DS, cópia **verbatim** do pacote da skill `stonni-design-interno/tokens/*.css`, concatenados nesta ordem: fonts, colors, typography, spacing, radius, elevation, motion, semantic, base. **Não editar à mão** — se o pacote da skill mudar, gerar de novo com o mesmo comando de concatenação (ver histórico desta sessão). |
| `src/index.css` | A **ponte**: nomes antigos do app (`--blue-dark`, `--surface`, `--radius`, etc.) → tokens do DS. É **aqui** que se muda o design deste app — nunca no `ds/`. |

## A armadilha que a auditoria pegou

`--text-hint` é um nome que o app já usava em dezenas de lugares, e o DS **não** tem um token com
esse nome exato — o equivalente de lá é `--text-subtle`. Na primeira versão da ponte eu simplesmente
não declarei `--text-hint` (por engano, achando que vinha "de graça" como aconteceu com
`--text-muted`, que por coincidência tem o mesmo nome nos dois lados). Resultado: toda cor
"apagada" do app (rótulo, texto auxiliar, ícone secundário) ficava com um valor de cor **inválido**,
sem erro nenhum no console — só ficaria visualmente errado. O `auditar-tokens.py` (seção "USADOS E
NUNCA DEFINIDOS") pegou isso antes de ir para produção. Lição: nome que só existe em UM dos dois
lados também precisa de ponte — só nome **idêntico nos dois** dispensa.

## O que ficou de fora desta passada

- **`font-size` e `line-height` dentro de `style=` inline continuam em número literal** (`fontSize:
  13`, `fontSize: 22`, etc.) — são ~200+ pontos espalhados em quase todo componente. A auditoria
  não conta isso como pendência crítica (ela mede CSS solto, não `style=`), mas é o mesmo tipo de
  literal que a medida de espaçamento era. Converter para `--fs-*` é trabalho de verdade, separado
  desta sessão — comece por um componente pequeno (`ui/index.tsx`) se for tocar nisso.
- **`--radius-lg` do app** (cards, 8px) e **`--radius` do app** (controles, 6px via `--radius-md`)
  bateram por acaso com os valores do próprio DS — não precisaram de ponte. Se um dia esses dois
  precisarem divergir do padrão do DS, crie um nome novo em vez de reintroduzir o literal.
- **`tailwindcss`/`@tailwindcss/vite` continuam no `package.json`/`vite.config.ts`**, mas o app
  nunca usou classe utilitária de verdade (confirmado por grep antes de mexer) — o `@import
  "tailwindcss"` foi removido do `index.css` porque não fazia nada. Não removi a dependência do
  `package.json` para não ampliar o escopo desta mudança; é limpeza segura para uma sessão futura.
- **Os UI kits do pacote** (`ui_kits/suporte`, `revendedor`, `assistencia`, `admin`) são telas de
  referência para fluxo novo — não recriam este app. Não foram usados como código, só como fonte
  dos tokens.

## Como testar de novo

```bash
python "C:/Users/ecommerce06/Desktop/Aplicações Bononi/.claude/skills/aplicar-design-system/scripts/auditar-tokens.py" "C:/Aplicações da bononi/bononiecommerce" "C:/Aplicações da bononi/bononiecommerce/src/ds/stonni-ds.css"
```

Rodar sempre que adicionar hex ou medida literal nova numa tela — código novo que escreve
`padding:12px` reabre o buraco que esta sessão fechou.
