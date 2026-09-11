@AGENTS.md

# treino-app — contexto pro Claude Code

App pessoal **monousuário** de treino de academia + dieta, num app só. Referências de produto: **Heavy** (treino) e **MyFitnessPal** (dieta).

**Contexto de uso que manda em tudo:** iPhone, na academia, **uma mão**, entre séries (30-90s), **às vezes sem sinal**. Se uma decisão técnica conflita com esse cenário, o cenário ganha.

Projeto irmão, usado como **referência de padrão** (nunca de domínio): `C:\dev\leiloes-app`.

## Stack

- **Next.js 16** App Router + TypeScript estrito + Turbopack
- **Tailwind v4** + **shadcn/ui** (preset `base-nova` com `@base-ui/react` — **não Radix**)
- **Supabase** (Postgres + Auth) — projeto novo em **`sa-east-1` (São Paulo)**. O leilões-app está em West US e registra isso como subótimo; não repetir.
- **Zod**, **react-hook-form**, **date-fns** (pt-BR)
- **IndexedDB** (`idb`) como caminho de leitura offline + **service worker escrito à mão**
- Deploy **Vercel Hobby**, auto-deploy do `main`. **`vercel.json` fixa a região em `gru1`** (São Paulo): o padrão é `iad1` (Washington), e com o banco em `sa-east-1` cada consulta atravessava o hemisfério duas vezes. Medido em produção pelo `x-vercel-id`, que mostrava `gru1::iad1` — borda em SP, função nos EUA.

## Comandos

```bash
pnpm dev              # dev server (Turbopack), localhost:3000
pnpm build            # build de produção
pnpm typecheck        # npx tsc --noEmit
```

**`tsc --noEmit` falha em repo limpo, antes do primeiro build.** O Next 16 *gera* `LayoutProps`/`PageProps` em `.next/types`; sem eles, `app/layout.tsx` acusa `TS2304: Cannot find name 'LayoutProps'`. Rode `pnpm build` uma vez depois de clonar. Não "conserte" o layout tipando à mão.

**Windows + pnpm:** o `pnpm.exe` veio do winget e o PATH do shell pode não enxergar. Em comando direto, prepende:

```bash
export PATH="/c/Users/gabri/AppData/Local/Microsoft/WinGet/Packages/pnpm.pnpm_Microsoft.Winget.Source_8wekyb3d8bbwe:$PATH"
```

## As cinco regras que definem este projeto

Se você só ler cinco linhas deste arquivo, que sejam estas.

1. **A tela de sessão ativa é Client Component com estado local.** "Server Components por padrão / Server Actions pra mutation" vale pro resto do app e é **errado** aqui: round-trip por série é incompatível com o uso. Não "corrija" isso.
2. **Leitura local-first, escrita autoritativa no servidor.** O app lê do IndexedDB e sincroniza em background. Nunca buscar no servidor algo de que a tela de treino depende pra funcionar.
3. **`id` uuid gerado no client** em `sessoes`, `sessao_exercicios`, `series`, `refeicao_itens` — não `default gen_random_uuid()`. É o que torna o upsert idempotente e o retry seguro.
4. **Nenhuma coluna gerada pode depender de `now()`** ou de estado do servidor. Só aritmética imutável da própria linha, pra o número calculado offline bater exatamente com o gravado.
5. **Proibido hard delete** em tabela sincronizada. Exclusão é `arquivado = true`. Um `delete` é invisível pro sync delta e o registro ressuscita no próximo pull.

## Padrões herdados do leilões-app

- **Server Actions** pra mutation; API routes só pra cron/webhook/externo
- **Arquivo `"use server"` só exporta funções async.** `export const X = ...` passa no `tsc` e **quebra o build da Vercel**. Constante fica interna ou em `lib/`.
- **Cookies API é async no Next 16** — sempre `await cookies()`
- **`@base-ui/react` não tem `asChild`** — usar `render={<Component />}`
- **Zod nas duas pontas** (form + server action), schemas em `lib/validators/`
- **RLS obrigatória** em toda tabela, filtrando por `auth.uid()`, mesmo sendo monousuário
- **Coluna gerada nunca entra em `insert`/`update`** — no leilões-app o `reforma_simulacao_itens.total` já causou isso
- **Fórmula única em `lib/*/calc.ts`**, função pura, usada por client e server. Nunca duas implementações do mesmo cálculo.
- **Não inventar coluna** — schema é fixo em `supabase/migrations/`; perguntar antes de adicionar
- **pt-BR**: `Intl` com **`timeZone: "America/Sao_Paulo"` explícito** (o servidor da Vercel roda em UTC)
- **Migrations numeradas, rodadas à mão** no SQL editor do Supabase
- **`supabase gen types typescript` desde o dia 1** — o leilões-app tem tipos hand-rolled e um TODO pra regerar; começar certo. Bônus: os tipos marcam coluna gerada como read-only no `Insert`/`Update`.

## Mobile-first — o que isso significa aqui

Não é "responsivo". É uma mão, polegar, celular escorregando, 40 segundos.

- Ação primária na **zona do polegar** (terço inferior). Header é pra informação, não pra botão.
- Alvo de toque **≥ 44×44pt**. Números grandes, rótulos pequenos. **A UI densa de 10-12px do leilões-app é o oposto do que serve aqui** — lá você lê sentado, aqui você toca em pé.
- **Nada de `type="number"`.** `inputmode="decimal"` no peso, `numeric` nas reps. Melhor: steppers ±2,5 kg / ±1 rep e teclado numérico próprio na tela.
- `font-size: 16px` mínimo nos inputs, senão o iOS dá zoom ao focar. `touch-action: manipulation` mata o double-tap zoom.
- **Duas cascas de layout**, rotas separadas: shell com navegação, e **shell de sessão ativa sem navegação nenhuma**.
- **Navegação por rota, não modal empilhado.** Modal + teclado + swipe-back no iOS é onde a UX quebra.
- **Zero `<table>`.** A "tabela de séries" é lista com grid de 4 colunas.
- **Timer de descanso:** `setInterval` não sobrevive ao app em background no iOS. Guardar timestamp de fim e recalcular no `visibilitychange`.
- `navigator.wakeLock` (iOS 16.4+) pra tela não apagar no treino.

### `viewport-fit=cover` — as duas coisas andam juntas

Pra ter barra inferior colada na base é preciso, **no mesmo commit**:

1. `viewport.viewportFit = "cover"` + `appleWebApp.statusBarStyle = "black-translucent"`, e
2. padding com `env(safe-area-inset-bottom)` / `-top` no CSS.

**Contra-exemplo nomeado:** o leilões-app tentou só (1) e reverteu em 10/09 (commit `9c7c729`) — sem (2), o header sticky ia parar embaixo da Dynamic Island. Hoje `app/layout.tsx:36` de lá tem `statusBarStyle: "default"` e nenhum `env(safe-area-inset-*)` no CSS (o `CLAUDE.md` de lá está defasado nesse ponto — confira o código, não o doc).

## Auth — "o app não pode me deslogar" é requisito

- **Cookie posto pelo servidor** via `@supabase/ssr` + refresh no middleware. O ITP do Safari corta cookie escrito por JS (`document.cookie`) em 7 dias; cookie de `Set-Cookie` do servidor não sofre esse teto.
- No painel do Supabase: **"time-box user sessions" e "inactivity timeout" desligados** (é o default — a questão é não ligar sem querer).
- **O gate de auth não fica na frente do shell offline.** Falha de refresh bloqueia **sync**, nunca **uso**: a tela de treino renderiza do IndexedDB e mostra "offline, sincroniza depois". Middleware **não** redireciona a rota de sessão pra `/login`.
- **Pegadinha do iOS:** o PWA instalado tem storage próprio, separado do Safari. Instalar **primeiro**, logar **dentro** do app instalado.

## Ilustrações dos exercícios

`lib/treino/ilustracoes.ts` é **gerado** por `scripts/baixar-ilustracoes.py` — pra mudar, edite o `MAPA` do script e rode de novo. Fonte: [`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db), licença Unlicense (domínio público).

- **Duas fotos por exercício** (início e fim do movimento), alternadas em CSS puro. Não é gif: animação de verdade só existe em base proprietária.
- O mapa mora em **código, não no banco** — é estático, dispensa migration, e o service worker vai cachear os arquivos junto com o resto do app.
- `aprox: true` = mesmo movimento, aparelho diferente. **A UI avisa.** Melhor foto aproximada e rotulada do que nenhuma, e muito melhor que foto errada sem aviso.
- As instruções vêm da base **em inglês, sem tradução**, e a tela diz de onde vieram.

## Saída dos dados

`scripts/export.ts` (via `tsx`, service role) → `backups/AAAA-MM-DD/` com **JSONL por tabela** (fiel, reimportável) + **CSV** (legível em planilha).

- **Um export que nunca foi restaurado não é backup.** O restore num projeto Supabase vazio é tarefa executada, não intenção.
- Roda como tarefa agendada semanal (`.claude\scheduled-tasks\`). De quebra **mantém o free tier acordado** — a pausa é por 7 dias de inatividade.

## Ordem de construção — sem exceção

**Treino ponta a ponta → 3 semanas de uso real → só então dieta.** O schema pode nascer inteiro (é barato); a UI não. Ver `docs/PLANO.md`.

## Documentos

- **Plano completo** (modelo de dados, fontes, fases): [`docs/PLANO.md`](docs/PLANO.md)
- **Decisões de arquitetura**: [`DECISIONS.md`](DECISIONS.md) — ler antes de mudar qualquer coisa marcada ali
