# treino-app

App pessoal de treino de academia (e, mais pra frente, dieta). Monousuário.

Uso real: iPhone, na academia, uma mão, entre séries, às vezes sem sinal. Quando uma decisão técnica conflita com esse cenário, o cenário ganha.

## Rodar

```bash
pnpm install
cp .env.local.example .env.local   # e preencher
pnpm build                         # necessário ANTES do primeiro typecheck
pnpm dev
```

`pnpm typecheck` falha em repo recém-clonado até o primeiro `pnpm build`: o Next 16 gera `LayoutProps`/`PageProps` em `.next/types`.

## Comandos

| | |
|---|---|
| `pnpm dev` | dev server (Turbopack) |
| `pnpm build` | build de produção |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm check-env` | confere se as chaves conectam (não imprime valor) |
| `pnpm export` | backup em `backups/AAAA-MM-DD/` (jsonl + csv) |
| `pnpm restore` | restaura um backup; `--wipe` apaga antes |
| `pnpm importar-heavy` | importa o histórico do Heavy (idempotente) |

## Estado

Treino ponta a ponta em construção; **dieta só depois de 3 semanas de uso real**. 1258 séries de histórico importadas do Heavy (jun/2025 → set/2026).

Falta: service worker (o app ainda não abre sem rede) e a camada local em IndexedDB.

## Antes de mexer

- [`CLAUDE.md`](CLAUDE.md) — convenções, e as cinco regras que definem o projeto
- [`DECISIONS.md`](DECISIONS.md) — o porquê de cada escolha, e o custo aceito
- [`docs/PLANO.md`](docs/PLANO.md) — modelo de dados e roadmap

Duas que costumam ser "consertadas" por engano: a tela de sessão ativa é Client Component de propósito (D-008), e coluna gerada nunca entra em `insert` (D-003).

## Migrations

Em `supabase/migrations/`, numeradas, **rodadas à mão** no SQL editor do Supabase. Depois de cada uma:

```bash
npx supabase gen types typescript --project-id <ref> > types/database.ts
```
