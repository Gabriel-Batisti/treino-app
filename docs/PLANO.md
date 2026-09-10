# Plano — treino-app

Aprovado em 10/09/2026. Decisões numeradas em [`../DECISIONS.md`](../DECISIONS.md); convenções de código em [`../CLAUDE.md`](../CLAUDE.md).

**Contexto que manda em tudo:** iPhone, na academia, uma mão, entre séries, às vezes sem sinal. Usuário único.

---

## 1. Modelo de dados

Convenções gerais:

- `id uuid` **gerado no client** nas tabelas do fluxo (`sessoes`, `sessao_exercicios`, `series`, `refeicao_itens`) — upsert idempotente, retry seguro (D-007)
- `atualizado_em timestamptz` + trigger `set_updated_at` em toda tabela sincronizada
- **Sem hard delete** em tabela sincronizada: `arquivado boolean` (D-007)
- RLS por `auth.uid()` em tudo, mesmo monousuário
- `nome_busca` = nome normalizado (minúsculo, sem acento) pra busca local

### 1.1 Treino

**`exercicios`** — catálogo (importado do Heavy + seed)

| coluna | notas |
|---|---|
| `nome`, `nome_busca` | `nome_busca` é a chave de dedupe import↔seed (D-014) |
| `grupo_muscular`, `equipamento` | vêm do `free-exercise-db` |
| `modo_medicao` | `peso_reps` \| `tempo` \| `distancia` \| `peso_corporal_reps` — **decide qual UI a linha de série renderiza**. Sem ela, prancha e supino disputam o mesmo formulário. |
| `unilateral bool` | a UI decide o que fazer; o DB não dobra carga |
| `fonte` | `seed` \| `importado_heavy` \| `manual` |
| `usos int`, `ultimo_uso_em` | ranking da busca; populados pela importação no dia 1 |
| `favorito`, `fixado`, `ordem_manual` | plano B de ranking se a importação atrasar |
| `arquivado bool`, `atualizado_em` | |

**`rotinas`** — `nome`, `notas`, `ordem`, `arquivada`, `atualizado_em`

**`rotina_exercicios`** — `rotina_id`, `exercicio_id`, `ordem`, `series_alvo`, `reps_alvo_min`, `reps_alvo_max`, `descanso_seg`, `superset_grupo`, `notas`

**`sessoes`**

| coluna | notas |
|---|---|
| `rotina_id` | nullable → treino livre; **null em tudo que for importado** |
| `nome` | snapshot do título |
| `inicio_em`, `fim_em` timestamptz | |
| `data_local date` | **gravada pelo client** (D-012) |
| `status` | `em_andamento` \| `concluida` \| `abandonada` — só `concluida` alimenta o "anterior" |
| `origem` | `app` \| `importado_heavy` — rastreabilidade + reimportação idempotente |
| `peso_corporal_kg`, `notas`, `sincronizado_em`, `atualizado_em` | |

**`sessao_exercicios`** — `sessao_id`, `exercicio_id`, `ordem`, `nome_snapshot`, `modo_medicao_snapshot`, `superset_grupo`, `notas`

> Existe pra você trocar exercício no meio do treino sem editar a rotina. `superset_grupo` aqui (e não só em `rotina_exercicios`) porque senão o superset histórico se perde na importação.

**`series`** — `sessao_exercicio_id`, `indice` (1..n), `tipo` (`normal` \| `aquecimento` \| `drop` \| `falha` \| `backoff`), `peso_kg`, `reps`, `rpe` (D-015), `duracao_seg`, `distancia_m`, `concluida bool`, `registrada_em timestamptz` — **do relógio do celular**, não `now()`

### 1.2 Dieta

**`alimentos`** — catálogo unificado, **sempre por 100 g/ml**
`nome`, `nome_busca`, `marca`, `fonte` (`taco` \| `off` \| `manual`), `fonte_id`, `codigo_barras`, `kcal_100`, `proteina_100`, `carbo_100`, `gordura_100`, `fibra_100`, `sodio_mg_100`, `densidade_g_ml`, `verificado bool`, `usos int`, `ultimo_uso_em`, `favorito`, `arquivado`, `atualizado_em`

> Índice **único parcial** em `(codigo_barras) where codigo_barras is not null` — mesmo padrão do `(imovel_id, message_id)` de `interacoes` no leilões-app. É o que torna o cache de scan idempotente.

**`alimento_porcoes`** — `alimento_id`, `rotulo` ("1 fatia", "1 colher de sopa"), `gramas`, `padrao bool`, `ordem`

> É a diferença entre logar em 3 toques e em 12. Não é opcional.

**`refeicao_itens`** (sem tabela pai — D-013)
`data_local date`, `tipo_refeicao` (`cafe` \| `almoco` \| `lanche` \| `jantar` \| `ceia`), `horario timestamptz`, `alimento_id`, `porcao_id` nullable, `quantidade`, `gramas`, `ordem`
\+ **snapshot** (D-011): `nome_snap`, `kcal_100_snap`, `proteina_100_snap`, `carbo_100_snap`, `gordura_100_snap`

**`receitas` / `receita_itens`** — ao logar, **expande em `refeicao_itens`**; não referencia a receita (D-011)

**`metas`** — `vigente_de date`, `kcal`, `proteina_g`, `carbo_g`, `gordura_g`. **Linha nova a cada mudança, nunca `update`** — assim o dia passado compara com a meta que valia naquele dia.

**`medidas`** — `data_local`, `peso_kg`, `cintura_cm`, `gordura_pct`

### 1.3 Colunas geradas (D-003)

**Regra:** aritmética imutável da própria linha, quando se quer filtrar/ordenar em SQL.

| tabela | coluna | fórmula |
|---|---|---|
| `series` | `volume_kg` | `peso_kg * reps` |
| `series` | `e1rm` | `case when peso_kg > 0 and reps between 1 and 12 then round(peso_kg * 36.0 / (37 - reps), 2) end` — **Brzycki** (D-004) |
| `sessoes` | `duracao_seg` | `extract(epoch from fim_em - inicio_em)` — subtração de `timestamptz` é imutável |
| `refeicao_itens` | `kcal`, `proteina`, `carbo`, `gordura` | `round(gramas * <macro>_100_snap / 100, 1)` |
| `alimentos` | `kcal_calc` | `4*proteina_100 + 4*carbo_100 + 9*gordura_100` — detector de lixo do OFF (D-010) |

**O que NÃO é coluna gerada, e por quê:**

- **Total da refeição / do dia** — cruza linhas. View `dia_totais`.
- **Volume da sessão, tonelagem, séries efetivas** — cruza linhas, e ainda precisa excluir `tipo = 'aquecimento'`. View.
- **PR / recorde / "bateu o anterior"** — depende do histórico inteiro. Função pura em `lib/treino/calc.ts`, usada por client e server. **Uma fórmula só.**
- **Macros a partir do `alimento` vivo** — proibido; é snapshot (D-011).

**Lembrete:** coluna gerada **nunca** entra em `insert`/`update`. Os tipos do `supabase gen types` já as marcam read-only.

---

## 2. Banco de alimentos

Ver D-010. Resumo operacional:

| | TACO | Open Food Facts |
|---|---|---|
| papel | **seed embarcado** (~600) | **lookup sob demanda** + cache-on-write |
| cobre | in natura e preparações BR | industrializado com EAN |
| qualidade | laboratorial | colaborativo — buracos, duplicata, kcal em kJ |
| barcode | não | é o ponto forte |

**Normalizar na importação do OFF:** `energy-kcal_100g` vs `energy_100g` (kJ), porção vs 100 g, campos ausentes. O `kcal_calc` sinaliza o resto.

### Código de barras no iOS

`BarcodeDetector` **não existe no Safari** (Chromium-only). Então:

- **A (principal):** `getUserMedia` + **ZXing-wasm** decodificando o stream, em `dynamic import` preguiçoso (centenas de KB — fora do bundle inicial). Funciona em PWA instalado a partir do **iOS 14.3**; exige HTTPS (a Vercel dá).
- **B (fallback):** `<input type="file" accept="image/*" capture="environment">` + decode da foto parada.
- **C:** digitar os 13 dígitos.

**Caso de borda aceito de propósito:** barcode desconhecido e sem sinal → grava o item com o EAN e macros em branco, marca "pendente", resolve depois. Você escaneia em casa, não na academia.

---

## 3. Registrar série puxando a anterior

**Definição (D-005):** "anterior" = `(exercicio_id, indice)` da sessão **`concluida`** mais recente que contenha o exercício, ignorando `tipo = 'aquecimento'`. **Não** vem da rotina.

**De onde é lida (D-007):** do **IndexedDB**, store `desempenho_por_exercicio`. Nunca de uma chamada no "começar treino" — offline no minuto zero é o caso que o app existe pra resolver.

**Como o store é mantido:**
1. **Escrita local primeiro** — ao finalizar uma sessão, o store é atualizado no aparelho, antes de qualquer sync
2. **Pull delta em background** quando há rede (`where atualizado_em > ultimo_sync`) — rede de segurança e caso de aparelho novo

A query do lado servidor, quando roda: `distinct on (exercicio_id, indice)` sobre `series` ⨝ `sessao_exercicios` ⨝ `sessoes`, ordenado por `exercicio_id, indice, inicio_em desc`.

**O que a linha mostra:** `80 kg × 8` em cinza + "há 5 dias" + badge quando é o melhor e1RM do exercício.

**Semântica de preenchimento** (é aqui que se erra):

- **Não** auto-preencher os dois campos — você acaba registrando série que não fez
- **Peso** entra preenchido (raramente muda); **reps** fica como placeholder
- Tocar ✓ com os campos vazios **commita o anterior inteiro** — o "fiz igual" em um toque, que é o caso mais comum
- Índice além do que existia (fez 4 séries, antes eram 3) → cai na última conhecida, marcada como extrapolada

**Progressão** — camada opcional, `lib/treino/progressao.ts`, função pura: bateu o topo da faixa de reps em todas as séries → sugere +2,5 kg. **Sugere, não aplica** (mesmo princípio do pré-filtro do Descobertos no leilões-app: veredito é sugestão, decisão é do usuário).

---

## 4. Offline

| opção | o que é | custo | o que ainda quebra |
|---|---|---|---|
| 0. Nada | Server Actions puro | 0 | spinner de 8s entre séries; série perdida. Inaceitável |
| A. Otimista em memória | fila com retry | ~1 d | reload / Safari descartando a aba perde tudo |
| **B. Rascunho em IndexedDB** | sessão vive no client, persiste a cada toque | 2-3 d | o app não *abre* sem rede |
| **C. Service worker** | precache do shell + catálogos | 1,5-2 d + custo permanente de versionar cache | — |
| D. Sync engine | PowerSync/Electric/RxDB | 1-2 semanas + serviço externo | nada, e por isso é caro |

**Decidido: B + C são o mínimo (D-006), leitura local-first (D-007), e para aí.** D só se entrar Apple Watch ou segundo aparelho.

**Service worker:** escrito à mão em `public/sw.js`. Precache do shell + assets, network-first pro resto, nome de cache com build id, prompt de recarregar. Não usar `next-pwa`/Serwist (ver D-006).

**Requisitos que isso impõe:** ver D-007 (`atualizado_em`, sem hard delete) e D-009 (auth não bloqueia uso offline).

---

## 5. Saída dos dados (D-016)

`scripts/export.ts` → `backups/AAAA-MM-DD/`:
- **JSONL por tabela** — fiel, reimportável
- **CSV** — treino e dieta legíveis em planilha

Tarefa agendada semanal em `.claude\scheduled-tasks\`. Mantém o free tier acordado de quebra (pausa por 7 dias de inatividade).

**Bloqueante antes de depender do app:** o primeiro restore num projeto Supabase vazio tem que ter sido **executado**.

---

## 6. Importação do histórico do Heavy

**Formato pedido:** **CSV do histórico completo, uma linha por série.** Não JSON de backup, não PDF. CSV porque é auditável linha a linha, reprocessável, e confere sem ferramenta.

**Colunas necessárias:** início/fim do treino · título · nome do exercício · índice da série · tipo (normal/aquecimento/falha/drop) · peso · **unidade (kg/lb)** · reps · rpe · duração · distância · id de superset · notas do exercício · notas do treino.

**Mapeamento:**

| export | destino |
|---|---|
| treino | `sessoes` — `status='concluida'`, `rotina_id=null`, `origem='importado_heavy'`, `data_local` do horário local |
| título | `sessoes.nome` |
| exercício | `sessao_exercicios` (+ `exercicios` novo se `nome_busca` não casar) |
| série | `series` |
| rpe | `series.rpe` (D-015) |
| id de superset | `sessao_exercicios.superset_grupo` |

`volume_kg` e `e1rm` **se calculam sozinhos** na importação — são colunas geradas. O "anterior" funciona no primeiro treino porque a query só filtra `status='concluida'`: não distingue série importada de digitada.

**Verificar:** se o peso vier em **lb**, converter (×0,45359237).

**Perdas aceitas e registradas:**
- **Não vêm rotinas** — o export é histórico, não template. Remontar à mão (ou inferir dos títulos mais frequentes, opcional).
- **Não vem horário por série** — `registrada_em` cai pro `inicio_em` da sessão. Irrelevante retroativamente.

**Idempotência:** chave natural (`origem`, `inicio_em`, `nome do exercício`, `indice`) → reimportar o mesmo arquivo não duplica. Script tem `--dry-run` obrigatório antes do commit real.

---

## 7. Ordem de construção

```
1. 0001 migration + supabase gen types                    0,5 d
2. export + primeiro restore testado                      0,5 d   ← antes de depender
3. importação do Heavy (precisa do arquivo)               1-1,5 d
4. camada local: IndexedDB + sync delta + service worker  3,5-5 d ← fundação
5. catálogo (seed pós-import) + rotinas                   1,5 d
6. sessão ativa com "anterior" lendo do local             3 d
7. histórico/recordes + polish PWA                        1,5 d
                                                    total 12,5-14,5 d
   → 3 SEMANAS DE USO REAL → só então dieta
```

**Duas inversões em relação ao rascunho inicial:**
- A **importação sobe pro começo** — é o que faz o "anterior" ser real no primeiro treino, e dá dado de verdade pra desenvolver a tela em cima
- A **camada local vem antes da tela de sessão**, não depois. Se a tela nascer lendo do servidor, ela é reescrita.

O passo 3 depende do arquivo do usuário; se atrasar, 4 roda antes (a importação é idempotente, a ordem entre 3 e 4 é livre). **1 e 2 não são negociáveis em ordem.**

---

## 8. Riscos

**1. São dois apps, não um.** Heavy e MyFitnessPal são produtos separados com anos de polimento. Construir os dois em paralelo entrega os dois pela metade — e um app de dieta pela metade contamina a metade de treino que estava boa.
→ *Mitigação:* **Treino → 3 semanas de uso → dieta. Sem exceção.** Modele o treino por inteiro (não pela metade), mas **`0001` não traz tabela de dieta**: tabela morta gera tipo morto, e o schema da dieta só melhora com 3 semanas de uso real do treino. Dieta é a `0002`.

**2. Atrito de registro — o maior, e é de produto.** O que faz o MFP funcionar não é o banco; é histórico, favoritos, porções nomeadas e "repetir ontem". Se logar o almoço der 12 toques, você para. O modo de falhar é gastar as primeiras semanas em importação de dados e nascer com busca ruim.
→ *Mitigação:* TACO seed + 30 alimentos fixados à mão + "repetir refeição de ontem" **antes** de qualquer scraper. No treino: se "repetir a série anterior" não for um toque, o app perdeu pro papel.

**3. PWA no iOS + offline é onde o projeto morre tecnicamente.** Sem notificação local pro timer; scanner dependendo de wasm e de versão do iOS; service worker com cache versionado (a categoria de bug mais chata que existe); IndexedDB sujeito a eviction pelo Safari — o cap de 7 dias do ITP não se aplica a app instalado na tela de início, mas "não se aplica hoje" não é garantia de durabilidade.
→ *Mitigação:* **IndexedDB é buffer, nunca a única cópia** (D-007 + D-016), e a saída pro Expo é plano B conhecido (D-001), não derrota.

*Menção honrosa:* rotatividade de schema. Você vai querer mudar o modelo de séries depois de 3 semanas de uso real. Migrations numeradas rodadas à mão + `DECISIONS.md` desde a primeira linha.
