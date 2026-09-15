# Como montamos um app pessoal de ponta a ponta

Este documento descreve a estrutura real de um app que está em produção e em uso
diário — stack, hospedagem, banco, offline, autenticação, backup e as regras que
seguram tudo de pé. O app em questão é de treino de academia, mas quase nada
aqui é sobre academia: é sobre **como montar um app pequeno que você vai usar
todo dia e não quer que quebre**.

Foi escrito pra ser aplicado em outro app. Onde a decisão depende do domínio, o
texto diz qual é a pergunta que você tem que responder antes de copiar.

Custo de tudo isso hoje: **R$ 0/mês** (free tier de Vercel + Supabase), mais o
domínio se você quiser um.

---

## 0. A regra que vem antes da stack

Antes de escolher qualquer coisa, escreva **uma frase** dizendo onde o app vai
ser usado. A nossa:

> iPhone, na academia, **uma mão**, entre séries (30–90s), **às vezes sem sinal**.

Essa frase virou a primeira seção do `CLAUDE.md` do projeto, com uma cláusula
explícita: **se uma decisão técnica conflita com esse cenário, o cenário ganha.**

Não é enfeite. Foi essa frase que decidiu, sozinha:

- que o app precisa de **service worker** (sem sinal, sem app);
- que a tela principal **lê do banco local**, não do servidor;
- que a tela principal é **Client Component**, contrariando o padrão do resto
  do app — round-trip por toque é incompatível com 40 segundos de descanso;
- que **não existe `type="number"`** em lugar nenhum (o teclado do iOS é ruim) e
  que todo alvo de toque tem no mínimo 44×44pt.

Se o seu app é um painel que você abre sentado no notebook, metade deste
documento não se aplica — e você economiza semanas. Escreva a frase primeiro.

---

## 1. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **Next.js 16** (App Router) + **TypeScript estrito** | Server Components pra ler, Server Actions pra escrever. Menos código de API. |
| Build | **Turbopack** (padrão do Next 16) | — |
| UI | **Tailwind v4**, componentes escritos à mão | ver abaixo |
| Banco + Auth | **Supabase** (Postgres gerenciado) | Postgres de verdade, RLS, Auth, Storage e um free tier honesto. |
| Validação | **Zod** | O mesmo schema valida no formulário e na server action. |
| Banco local | **IndexedDB** via `idb` | Leitura offline. |
| Offline | **Service worker escrito à mão** | ver §6 |
| Hospedagem | **Vercel** (Hobby) | Deploy automático do `main`, zero configuração. |
| Gerenciador | **pnpm** | — |

As dependências de produção, inteiras — são onze:

```
@dnd-kit/core  @dnd-kit/sortable  @dnd-kit/utilities
@supabase/ssr  @supabase/supabase-js
idb  next  react  react-dom  zod
unpdf  web-push
```

### O que planejamos usar e não usamos

Este é o ponto mais útil da seção. O plano original listava **shadcn/ui**,
**react-hook-form** e **date-fns**. Nenhum dos três foi instalado.

- **shadcn/ui** — os componentes são pensados pra densidade de desktop. O app é
  de uma mão, com botão de 56px de altura. Escrever o botão em Tailwind puro deu
  menos trabalho do que desconfigurar o pronto.
- **react-hook-form** — os formulários têm de 3 a 6 campos. `useState` resolve.
- **date-fns** — `Intl.DateTimeFormat` faz tudo que a gente precisava e já vem
  no runtime. Um arquivo de 40 linhas (`lib/format.ts`) cobre o app inteiro.

**Regra que sai daí:** instale a biblioteca quando doer sem ela, não quando o
tutorial mandar. Cada dependência é uma coisa pra atualizar, um bundle maior e
uma chance de não suportar a próxima versão do framework.

---

## 2. Hospedagem

### Vercel (Hobby, grátis)

- Auto-deploy do `main`. Push → build → produção.
- Preview deploy por branch, de graça.
- Variáveis de ambiente pelo painel, separadas por ambiente.

Duas coisas que só descobrimos rodando:

**1. Fixe a região.** O padrão da Vercel é `iad1` (Washington). Com o banco em
São Paulo, cada consulta atravessava o hemisfério duas vezes. O sintoma aparece
no header `x-vercel-id` da resposta: `gru1::iad1` — borda em SP, função nos EUA.

```json
{
  "regions": ["gru1"],
  "crons": [{ "path": "/api/lembrete", "schedule": "0 10 * * *" }]
}
```

**2. Cron na Hobby é 1×/dia e impreciso.** A Vercel documenta precisão de hora:
agendado pras 10:00 UTC, dispara entre 10:00 e 10:59. Pra um lembrete matinal
isso é irrelevante, e a gente aceitou explicitamente. Se precisar de hora exata
e de graça, o caminho é `pg_cron` no Supabase chamando a mesma rota — não é o
plano pago.

Variável de ambiente adicionada **depois** de um deploy não entra nele. Tem que
redeployar. O painel mostra "Added 1m ago" ao lado de cada uma — é assim que se
descobre que o problema era esse.

### Supabase (free tier)

- **Escolha a região perto do usuário.** A nossa é `sa-east-1` (São Paulo). Um
  projeto irmão nosso ficou em West US e paga ~150 ms por consulta, de graça.
- **O free tier pausa o projeto com 7 dias de inatividade.** Nosso backup
  semanal automático resolve isso de lambuja (§9).
- Limites que importam: 500 MB de banco, 1 GB de Storage, 2 projetos ativos.
- **Migrations numeradas, rodadas à mão** no SQL editor: `0001_treino.sql`,
  `0002_cardio.sql`, … Cada arquivo começa com um comentário dizendo o que faz e
  quais decisões obedece, e é **re-executável** (`create table if not exists`,
  `drop policy if exists` antes de `create policy`).
- Depois de **cada** migration, regerar os tipos:

```bash
npx supabase gen types typescript --project-id <ref> > types/database.ts
```

Isso não é só conforto: os tipos gerados marcam **coluna gerada como read-only**
no `Insert`/`Update`, o que mata uma classe inteira de erro em tempo de
compilação.

> Um detalhe que custa tempo: se você tiver aliases ou tipos seus escritos à
> mão, **não** os coloque em `types/database.ts` — a regeração apaga o arquivo
> inteiro. Eles moram em `types/app.ts`.

### Storage (quando houver arquivo do usuário)

Bucket **privado**, com policy por pasta (`<user_id>/arquivo.jpg`), e a tela
pede uma **URL assinada de vida curta** (10 minutos) na hora do toque. Nunca
guarde a URL no banco — guarde o **caminho**; URL assinada expira e a linha vira
lixo.

---

## 3. Estrutura de pastas

```
app/
  (tabs)/            # casca COM navegação inferior (as telas do dia a dia)
    page.tsx
    layout.tsx
  sessao/            # casca SEM navegação nenhuma (a tela de foco)
  login/
  actions/           # server actions, uma por domínio
    treino.ts  cardio.ts  medidas.ts  sync.ts
  api/               # SÓ cron, webhook e integração externa
  layout.tsx
  globals.css
components/          # componentes compartilhados entre telas
lib/
  supabase/          # client.ts (browser), server.ts (RSC/actions), proxy.ts
  local/             # db.ts (IndexedDB), sync.ts (fila + delta)
  treino/            # regra de negócio do domínio, funções PURAS
    calc.ts  substituir.ts  texto.ts
  format.ts          # pt-BR, com timeZone explícito
public/
  sw.js              # service worker
supabase/migrations/ # 0001_…, 0002_…, numeradas
scripts/             # tsx, rodados à mão (export, restore, import, seed)
types/
  database.ts        # GERADO — não editar
  app.ts             # aliases e tipos escritos à mão
docs/
CLAUDE.md
DECISIONS.md
```

Três decisões de layout que valem a pena copiar:

**Server Actions pra mutação; `app/api/` só pra quem não tem sessão.** Cron,
webhook e integração externa vão em `api/`. Todo o resto do app escreve por
server action. Isso elimina metade do código de API e o `fetch` correspondente.

**Duas cascas de layout, em rotas separadas.** Uma com navegação e header, outra
sem nada — a tela de foco. Tentar esconder a navegação condicionalmente dentro
de um layout só dá errado no primeiro caso de borda.

**Regra de negócio em `lib/<dominio>/*.ts`, como função pura.** A mesma função é
importada pelo Client Component e pela server action. **Nunca duas
implementações do mesmo cálculo** — é assim que o número da tela passa a
divergir do número do banco.

Uma armadilha do Next que custa meia hora: **arquivo `"use server"` só pode
exportar função async.** `export const X = ...` passa no `tsc` e **quebra o build
da Vercel**. Constante fica interna ou em `lib/`.

---

## 4. Banco de dados — as regras que generalizam

Estas sete não têm nada de academia. Aplique em qualquer app com sincronização
ou uso offline.

### 4.1 RLS obrigatória em toda tabela, mesmo sendo monousuário

```sql
alter table exercicios enable row level security;
create policy "own_exercicios" on exercicios for all
  using (user_id = auth.uid());
```

Custa uma linha. Sem ela, a chave `anon` — que roda **no navegador** e é visível
pra qualquer um — lê a tabela inteira. "É só pra mim" é exatamente o app que
ninguém audita depois.

E no servidor: `user_id` **nunca** vem do corpo da requisição, vem de
`auth.getUser()`. Se vier do body, qualquer um escreve na conta de qualquer um.

### 4.2 `id` gerado no client, não `default gen_random_uuid()`

Nas tabelas que o app grava offline, o `id` é um `crypto.randomUUID()` gerado no
aparelho. É isso que torna o `upsert` idempotente: se a rede cair no meio, o
retry grava o **mesmo** id e não duplica.

### 4.3 Proibido hard delete em tabela sincronizada

Exclusão é `arquivado = true` (catálogo) ou `excluido_em timestamptz` (linha
filha). Um `DELETE` é **invisível** pro sync incremental: o aparelho nunca fica
sabendo, e o registro ressuscita no próximo pull.

### 4.4 `atualizado_em` + trigger em toda tabela sincronizada

```sql
create or replace function set_updated_at() returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

create trigger x_set_updated_at before update on x
  for each row execute function set_updated_at();
```

Sem isso não existe sync delta — só "baixar tudo de novo". E um índice
`(user_id, atualizado_em)` em cada uma delas.

### 4.5 `data_local date` separada do `timestamptz`

Esta é a que mais pega gente desprevenida. **O servidor da Vercel roda em UTC.**
A janta das 22h no Brasil vira o dia seguinte lá. Então toda linha que você
agrupa por dia tem **duas** colunas:

- `criado_em timestamptz` — o instante, verdade absoluta;
- `data_local date` — o dia **segundo o relógio do usuário**, gravado pelo
  client.

Agrupar por `date(ts at time zone 'America/Sao_Paulo')` também funcionaria, mas
obriga a repetir o fuso em toda query e mata o índice.

Corolário na UI: `Intl` **sempre** com `timeZone: "America/Sao_Paulo"`
explícito. E uma string `"2026-09-13"` vira data com
`new Date("2026-09-13T12:00:00-03:00")` — **meio-dia**, nunca meia-noite, senão
o fuso empurra pro dia anterior.

### 4.6 Coluna gerada só pra aritmética imutável da própria linha

```sql
e1rm numeric generated always as (
  case when peso_kg > 0 and reps between 1 and 12
  then round(peso_kg * 36.0 / (37 - reps), 2) end
) stored
```

Vale a pena quando é aritmética da própria linha **e** você quer filtrar ou
ordenar por ela em SQL. Duas restrições:

- **Nada que dependa de `now()`** ou de estado do servidor — senão o número
  calculado offline no aparelho diverge do gravado no banco.
- Tudo que cruza linhas (total do dia, ranking, streak) vira **view** ou
  **função pura em TypeScript**, nunca coluna gerada. O Postgres nem permite o
  contrário.

E coluna gerada **nunca** entra em `insert`/`update` — é o erro que os tipos
gerados pegam pra você (§2).

### 4.7 Snapshot em vez de referência viva, onde o histórico importa

Quando uma linha registra um fato do passado que depende de um cadastro (preço
de um produto, calorias de um alimento, nome de um item), **copie o valor pra
dentro da linha**. Se guardar só a FK, corrigir o cadastro amanhã **reescreve o
seu histórico em silêncio**.

### Detalhe de PostgREST que morde

O `select` do Supabase devolve **1000 linhas por padrão**. Qualquer coisa que
você acredita ser "tudo" e não pagina com `.range()` está mentindo — export,
gráfico de histórico, contagem.

---

## 5. Autenticação

Requisito declarado: **"o app não pode me deslogar"**. Uso diário; pedir login
toda semana faz o app deixar de ser aberto.

- **`@supabase/ssr`**, com o cookie posto **pelo servidor** e refresh no
  middleware. Isso importa no Safari: o ITP corta cookie escrito por JavaScript
  (`document.cookie`) em **7 dias**; cookie que veio de um `Set-Cookie` do
  servidor não sofre esse teto.
- No painel do Supabase, "time-box user sessions" e "inactivity timeout"
  **desligados** (é o padrão — a questão é não ligar sem querer).
- **No Next 16, `middleware.ts` virou `proxy.ts`** e a função exportada chama
  `proxy`. Mesma semântica. (E `cookies()` agora é async: `await cookies()`.)

Três armadilhas do matcher, todas custaram tempo:

```ts
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|sessao|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
```

- **`api` fora do matcher**, senão o webhook ou a integração externa — que não
  têm sessão — são redirecionados pro `/login` e nunca funcionam.
- **`/auth/*` nunca pode cair no gate**: é onde a sessão nasce. Sem isso, o link
  mágico do e-mail é redirecionado antes do route handler rodar.
- E, no nosso caso, **a rota de foco também está fora**: ela renderiza do banco
  local. Falha de refresh bloqueia **sincronização**, nunca **uso**.

> **iOS, específico:** o PWA instalado na tela de início tem storage **separado**
> do Safari. Instale primeiro, faça login **dentro** do app instalado.

---

## 6. Offline — a parte que quase todo mundo pula

Se o seu app precisa abrir sem rede, são **duas** camadas, e elas resolvem
problemas diferentes:

- **IndexedDB** protege o **dado** (o que você escreveu não some);
- **Service worker** faz o app **existir** (sem ele, nem o HTML carrega).

### Service worker

Escrito à mão, em `public/sw.js`. Não usamos `next-pwa`/Serwist de propósito:
amarrar o mínimo viável a um plugin que pode não suportar a próxima versão do
framework é risco desnecessário, e o arquivo tem ~120 linhas.

Estratégia por tipo de requisição:

| Tipo | Estratégia |
|---|---|
| navegação (HTML) | rede primeiro, cache como rede de segurança |
| `_next/static` | cache primeiro (o nome do arquivo já tem hash) |
| imagens imutáveis | cache primeiro |
| resto | passa direto |

**Nunca cachear POST** — Server Action é POST, e servir resposta velha de
gravação corrompe dado.

Quatro armadilhas que só apareceram rodando:

1. **`install` roda uma vez só.** Se o cache for apagado depois — e o Safari
   apaga storage — o worker segue "activated" e o precache **nunca** é refeito:
   o app falha offline em silêncio. Quem garante o cache tem que ser a
   **página**, a cada abertura, não o evento `install`.
2. **`cache.add` em paralelo falha.** Quatro rotas via `Promise.allSettled`
   gravavam só a primeira. Serialize.
3. **O chunk JS de uma rota não vira `<script>` no DOM** — vem por import
   dinâmico. Varrer o DOM não acha e `router.prefetch` não baixa. Abrir a rota
   offline sem nunca ter aberto online travava em "carregando…". Resolvido
   carregando cada rota uma vez num **iframe escondido**.
4. **Esse iframe carrega a página, que roda o registrador, que cria mais
   iframes.** Explosão exponencial. Guard: `if (window.top !== window.self) return;`

Teste de verdade, não de fé: derrube o servidor, abra o app, execute o fluxo
principal inteiro, suba o servidor e confira que subiu com os valores certos.

### IndexedDB + fila de envio

O padrão é **leitura local-first, escrita autoritativa no servidor**:

- O app **lê** do IndexedDB e sincroniza em background.
- O app **escreve** primeiro na fila local, depois envia.
- **Escopo estreito de propósito.** Só o caminho crítico mora no banco local. A
  régua é literal: *"eu preciso disto sem sinal?"*. Timeline, gráficos e
  configurações continuam lendo do servidor. Cada store é uma coisa a mais pra
  manter sincronizada.

A ordem do sync **não é negociável**: **empurra antes de puxar**. Se puxasse
primeiro, um registro ainda na fila seria sobrescrito por uma versão velha do
servidor.

A fila é uma store com `{ id, tipo, payload, tentativas, ultimoErro }`, e o
despacho é um `switch` por `tipo` que chama a server action correspondente.
`MAX_TENTATIVAS = 5` — depois disso parou de ser rede ruim e passou a ser dado
inválido; insistir pra sempre esconde o bug.

E uma regra de ouro: **nada na camada de sync pode lançar exceção pra cima.**
Falha de sincronização nunca pode virar tela branca.

> **Não confunda isto com um sync engine.** PowerSync/ElectricSQL/RxDB resolvem
> multi-device com resolução de conflito, custam 1–2 semanas mais um serviço
> externo, e pagam complexidade por um problema que a maioria dos apps pessoais
> não tem. Isto aqui é o ponto intermediário e cabe em dois arquivos.

---

## 7. UI mobile-first

"Mobile-first" aqui não significa "responsivo". Significa **uma mão, polegar,
celular escorregando, 40 segundos**.

- **Ação primária na zona do polegar** (terço inferior da tela). Header é pra
  informação, não pra botão.
- **Alvo de toque ≥ 44×44pt.** Números grandes, rótulos pequenos.
- **Nada de `type="number"`.** Use `inputMode="decimal"` ou `"numeric"`. Melhor
  ainda: steppers de ± ao lado do campo.
- **`font-size: 16px` no mínimo nos inputs**, senão o iOS dá zoom ao focar.
  `touch-action: manipulation` mata o double-tap zoom.
- **Navegação por rota, não modal empilhado.** Modal + teclado + swipe-back no
  iOS é onde a UX quebra.
- **Zero `<table>`.** "Tabela" vira lista com grid de N colunas.
- **Timer não sobrevive ao app em background no iOS.** `setInterval` congela.
  Guarde o **timestamp de fim** e recalcule no `visibilitychange`. Vale pra
  cronômetro, contagem regressiva, tudo.
- `navigator.wakeLock` (iOS 16.4+) pra a tela não apagar durante o uso.

### Input controlado com número: o bug que todo mundo escreve

Se o `useState` guarda `number` e o `onChange` faz `Number(e.target.value)`,
**o usuário não consegue digitar vírgula**: `Number("12,")` é `12`, o React
redesenha "12" e o caractere some. Guarde a **string** enquanto edita e converta
só ao salvar.

### `viewport-fit=cover`: as duas coisas andam juntas

Pra ter barra colada na base do iPhone, é preciso, **no mesmo commit**:

1. `viewport.viewportFit = "cover"` + `appleWebApp.statusBarStyle = "black-translucent"`, **e**
2. padding com `env(safe-area-inset-bottom)` / `-top` no CSS.

Um projeto nosso fez só (1) e teve que reverter: sem (2), o header sticky vai
parar **embaixo da Dynamic Island**.

### Gráfico com toque

Se tiver gráfico que o dedo varre, o eixo X tem que ser **tempo**, não índice da
lista — senão dois pontos separados por um ano ficam à mesma distância de dois
pontos separados por um dia, e o gráfico mente sobre o ritmo da mudança.

E no SVG: `touch-action: pan-y`. Com `none`, o gráfico prende a rolagem da
página; com `pan-y`, arrastar na horizontal varre e na vertical rola.

### `window.open` depois de `await` é bloqueado

Abrir aba num callback assíncrono não conta mais como gesto do usuário: o
navegador trata como pop-up e bloqueia **em silêncio**, sem erro no console. Se
precisar abrir um link que depende de uma chamada ao servidor, renderize um
`<a href>` de verdade na tela — é o único caminho que nenhum navegador bloqueia.

---

## 8. Segredos

- `.env*` no `.gitignore`, **antes do primeiro commit**.
- **Três chaves, três escopos:**
  - `NEXT_PUBLIC_SUPABASE_URL` e a chave **publishable/anon** — vão pro
    navegador, e tudo bem, **desde que a RLS esteja ligada**;
  - `SUPABASE_SERVICE_ROLE_KEY` — **ignora RLS**. Só em script de linha de
    comando. **Nunca** importada de `app/` ou `components/`. Se ela vazar pro
    bundle, acabou.
- Chave de webhook comparada com `timingSafeEqual`, não com `===`.
- **Screenshot do painel de variáveis de ambiente é o mesmo que colar a chave
  num chat.** Aconteceu com a gente; rotacionamos o par de chaves VAPID por
  causa disso. Se acontecer, rotacione — não avalie o risco, rotacione.
- Um script `pnpm check-env` que confere se as chaves **conectam** e descreve a
  chave (`"secret nova (52 chars)"`) sem **nunca** imprimir o valor. Output de
  script vai parar em log.

---

## 9. Backup

```
scripts/export.ts  →  backups/AAAA-MM-DD/
                       ├── tabela.jsonl   (fiel, reimportável)
                       └── tabela.csv     (legível em planilha)
```

Roda como tarefa agendada semanal. Duas frases resumem a política:

> **Um export que nunca foi restaurado não é backup.** O primeiro restore num
> projeto Supabase vazio é tarefa executada, não intenção.

> `backups/` **não** vai pro git — cresce sem limite e é dado pessoal.
> Durabilidade fora do computador = copiar a pasta pro Drive/OneDrive.

Existe um `scripts/restore.ts` com flag `--wipe`, e é ele que torna a primeira
frase verificável.

---

## 10. A documentação que segura o projeto

São três arquivos, cada um com uma função diferente. É o que mais rendeu, e é a
parte que quase ninguém copia.

### `CLAUDE.md` — as convenções

Lido por você e pelo agente de IA a cada sessão. Contém a frase do cenário de
uso, os comandos, e uma seção chamada **"As cinco regras que definem este
projeto"** — literalmente cinco linhas, com a instrução *"se você só ler cinco
linhas deste arquivo, que sejam estas"*.

Cada regra vem acompanhada de **"não 'corrija' isso"**, porque são justamente os
pontos que parecem erro pra quem chega: a tela principal é Client Component **de
propósito**; coluna gerada **nunca** entra em insert.

Inclua também as pegadinhas de ambiente. O nosso tem uma seção explicando que
`tsc --noEmit` **falha em repo recém-clonado** porque o Next 16 *gera*
`LayoutProps`/`PageProps` em `.next/types` — tem que rodar `pnpm build` uma vez
antes. Sem isso, a primeira reação é "consertar" o layout tipando à mão.

### `DECISIONS.md` — o porquê e o custo aceito

Uma entrada por decisão, numerada (`D-001`, `D-002`, …), com data:

```markdown
## D-0XX — <a decisão, numa frase afirmativa>
**data**

<o problema real que motivou>

**Alternativa rejeitada:** <qual, e por quê>

**Custo aceito:** <o que a gente perde com isso, explicitamente>
```

Duas convenções fazem esse arquivo funcionar:

1. **"Decisão registrada aqui não se muda sem uma entrada nova que a
   substitua."** Isso quebra o ciclo de desfazer e refazer a mesma escolha.
2. **Entradas ganham um pós-escrito depois de rodar** — *"Executado em 10/09:
   quatro armadilhas que só apareceram rodando"*. É de lá que saíram as quatro
   armadilhas do service worker da §6. A decisão prevista quase nunca é onde o
   problema aparece.

Uma entrada vale ouro: a que registra o que **não** funciona. A nossa `D-021`
documenta uma tarde inteira provando que os Atalhos do iOS não conseguem ler
treino do Apple Saúde, com as três portas testadas e o resultado de cada uma.
Sem ela, alguém — inclusive você, em dois meses — tenta de novo.

### `AGENTS.md` — o aviso sobre a versão

No nosso caso, um bloco curto avisando que **este Next não é o Next que o modelo
conhece**, e mandando ler `node_modules/next/dist/docs/` antes de escrever
código. Foi o que evitou uma sequência de `middleware.ts` (que virou `proxy.ts`)
e de APIs de cookie síncronas (que viraram `await cookies()`).

Se você usa um framework que mudou recentemente, esse arquivo economiza horas.

---

## 11. Ordem de construção

A nossa está escrita no `CLAUDE.md` com a palavra "sem exceção":

> **Treino ponta a ponta → 3 semanas de uso real → só então dieta.**

O raciocínio generaliza: **o schema pode nascer inteiro** — uma migration é
barata, e pensar o modelo de dados de uma vez evita retrabalho. **A UI não.**
Fazer duas features pela metade dá um app que você não usa, e um app que você
não usa não te ensina nada sobre o que ele deveria ser.

Três semanas de uso real valem mais do que três semanas de planejamento.

---

## 12. Uma regra de produto que mudou o app

Vale junto com as técnicas, porque economizou mais tempo que qualquer uma delas:

> **Resposta determinística vira botão. Julgamento vira conversa.**

A gente ia construir um "coach" de IA pra sugerir substituição de exercício.
Quando escrevemos o que ele faria, virou evidente que a resposta era
determinística — mesmo grupo muscular, mesma ênfase do movimento, equipamento
disponível. Isso é uma função pura com um sistema de pontuação, não um modelo de
linguagem: responde na hora, funciona offline, é de graça e dá sempre a mesma
resposta.

O coach ficou pra onde há julgamento de verdade. A feature saiu melhor **e** mais
barata.

Antes de plugar IA em qualquer coisa, pergunte se a resposta é derivável dos
dados que você já tem.

---

## 13. Checklist do dia 1

```
[ ] Escrever a frase do cenário de uso. Colar no CLAUDE.md.
[ ] Projeto Supabase na região do usuário.
[ ] vercel.json com a região da função na mesma região do banco.
[ ] .env* no .gitignore ANTES do primeiro commit.
[ ] Migration 0001 com: RLS, atualizado_em + trigger, data_local,
    índice (user_id, atualizado_em), exclusão lógica, id do client.
[ ] supabase gen types typescript  ->  types/database.ts
[ ] Tipos escritos à mão em types/app.ts (a regeração apaga o outro).
[ ] proxy.ts com api/ e auth/ FORA do matcher.
[ ] Script de export + um restore de verdade, num projeto vazio.
[ ] DECISIONS.md com a D-001: a stack, e a fronteira em que ela deixa de servir.
```

---

## 14. Onde esta stack deixa de servir

Vale registrar isso desde o dia 1, e a nossa `D-001` registra:

> Se as limitações do PWA no iOS incomodarem (timer sem notificação local,
> scanner de código de barras, HealthKit), o caminho é **Expo/React Native com o
> mesmo Supabase**. Manter o Postgres como fonte da verdade faz essa migração
> custar **a UI, não o dado**.

Concretamente, o que um PWA **não** faz no iOS, tudo verificado por nós:

- **Notificação local** — a que dispara sozinha com o app fechado. Web Push
  funciona, mas depende de servidor, e no iOS **exige o app instalado na tela de
  início**; no Safari a API nem existe.
- **Som ou vibração com o app em background.** `navigator.vibrate` não existe no
  iOS, e o Web Audio precisa de um gesto do usuário anterior.
- **Live Activity / Dynamic Island.** Nativo, ponto.
- **Ler dados do HealthKit.** Só app nativo com permissão concedida.

Nada disso impede o app de existir. Mas é melhor saber antes de prometer.

---

## 15. Resumo em dez linhas

1. Escreva a frase do cenário de uso. Ela decide mais do que a stack.
2. Next.js + Supabase + Vercel, tudo no free tier, todos na mesma região.
3. Server Components pra ler, Server Actions pra escrever, `api/` só pra quem
   não tem sessão.
4. RLS em tudo. `user_id` sempre de `auth.getUser()`, nunca do body.
5. `atualizado_em` + trigger, `data_local`, exclusão lógica e id do client. Estes
   quatro são o que torna sincronização possível.
6. Regra de negócio em função pura, uma implementação só.
7. Offline são duas camadas: service worker (o app existe) + IndexedDB (o dado
   sobrevive). Empurra antes de puxar.
8. Instale biblioteca quando doer sem ela.
9. `DECISIONS.md` com o **custo aceito** de cada escolha, e um pós-escrito
   depois de rodar.
10. Um export que nunca foi restaurado não é backup.
