# Decisões de arquitetura — treino-app

Formato: uma decisão por entrada, com o **porquê** e o **custo aceito**. Decisão registrada aqui não se muda sem uma entrada nova que a substitua.

---

## D-001 — Stack: Next.js + Supabase + Vercel (mantida)
**10/09/2026**

App pessoal de treino/dieta é CRUD + agregação; nada no caso de uso pede outra coisa, e há experiência prévia com a stack.

**Fronteira honesta:** se as limitações do PWA no iOS incomodarem (timer sem notificação local, scanner de código de barras, HealthKit), o caminho é **Expo/React Native com o mesmo Supabase**. Manter o Postgres como fonte da verdade faz essa migração custar a UI, não o dado.

---

## D-002 — Supabase em `sa-east-1` (São Paulo)
**10/09/2026**

O leilões-app está em West US e o próprio `DECISIONS.md` de lá registra como subótimo (~150ms). A vaga livre do free tier vai pra São Paulo.

---

## D-003 — Coluna gerada só pra aritmética imutável da própria linha
**10/09/2026**

`generated always as ... stored` quando é aritmética imutável da linha **e** se quer filtrar/ordenar por ela em SQL. Tudo que cruza linhas (total do dia, volume da sessão, PR, streak) vira **view** ou **função pura em `lib/*/calc.ts`** — Postgres não permite o contrário, e a fórmula única evita duas implementações divergentes.

**Corolário (D-003a):** nenhuma coluna gerada pode depender de `now()` ou de estado do servidor, senão o número calculado offline diverge do gravado. As colunas escolhidas são aritmética pura — isso não é coincidência, é o critério.

---

## D-004 — e1RM: fórmula de **Brzycki**, com teto em 12 reps
**10/09/2026**

`case when peso_kg > 0 and reps between 1 and 12 then round(peso_kg * 36.0 / (37 - reps), 2) end`

**Epley foi rejeitada:** infla série de 1 repetição em 3,3% (100 kg → 103,3). Como e1RM é coluna gerada e alimenta recorde pessoal, o erro entraria **no banco**, e todo PR de força nasceria errado.

Brzycki é **exata em 1 repetição** — o único ponto onde a resposta verdadeira é conhecida, e justamente onde o PR de força mora. Acima de 12 reps, `null`: qualquer e1RM ali é ficção, e `null` é mais honesto que um número inventado. O guard `peso_kg > 0` faz barra fixa e prancha caírem em `null` sozinhas (coluna gerada não enxerga outra tabela).

**Custo aceito:** os números ficam mais baixos que os de outro app abaixo de 10 reps. Irrelevante — o e1RM aqui só compara suas séries entre si, e a função é monótona em peso e em reps no intervalo 1-12.

**Consequência na UI:** a tela de recordes mostra **duas coisas**. Principal = **recorde por faixa de reps** (fato: "8 reps: 82,5 kg em 14/08"). Secundário = e1RM (estimativa). O PR de força nunca depende de fórmula.

---

## D-005 — "Anterior" por `(exercicio_id, indice)`, ignorando a rotina — ⚠️ **revisitar**
**10/09/2026 · revisar após 3 semanas de uso**

O desempenho anterior vem da sessão **concluída** mais recente que contenha aquele exercício, por índice de série — **não** da rotina. Se você fez 100 kg fora da rotina, é 100 kg que aparece.

**Risco conhecido:** em split com o mesmo exercício em **faixas de reps diferentes** (ex.: supino 5×5 na segunda e 3×12 na quinta), o "anterior" mistura as duas e confunde.

**Gatilho de revisão:** se isso acontecer na prática, a chave passa a ser `(exercicio_id, indice, faixa_de_reps_alvo)`. Não antecipar — a complexidade só se paga se o caso aparecer.

---

## D-006 — Service worker faz parte do mínimo, não do polish
**10/09/2026 · corrige a proposta inicial**

O rascunho em IndexedDB protege o **dado**; o service worker faz o app **existir**. Sem SW, sem rede nem o HTML carrega — e o caso de uso é literalmente chegar na academia com o app fora da memória e sinal ruim.

SW **escrito à mão** em `public/sw.js`, não `next-pwa`/Serwist: o `AGENTS.md` avisa que este Next não é o Next conhecido, e amarrar o mínimo viável a um plugin que pode não suportar Next 16 é risco desnecessário. Precache do shell + assets, network-first pro resto, nome de cache com build id, prompt de recarregar.

**Sinergia:** como a tela de sessão já é client-side (D-008), o SW só precisa servir shell estático + bundle. Se fosse Server Component, cachear payload RSC seria o pesadelo.

---

## D-007 — Leitura local-first, escrita autoritativa no servidor
**10/09/2026 · corrige a proposta inicial**

O "prefetch no início da sessão" foi **rejeitado**: se você estiver offline no minuto zero, entra no treino sem saber o que fez da última vez — que é o motivo principal do app existir.

O último desempenho por exercício, o catálogo de exercícios e o de alimentos **moram no IndexedDB** e são atualizados por **sync delta em background**. O store local é escrito **primeiro pela própria sessão recém-terminada**: como o usuário é único, a cópia local é a mais fresca em quase toda ocasião, e o pull da rede é rede de segurança + caso de aparelho novo.

**Consequências obrigatórias no schema:**
- `atualizado_em` + trigger `set_updated_at` em toda tabela sincronizada — sem isso não há delta
- **Proibido hard delete**: exclusão vira `arquivado = true`. Um `delete` é invisível pro sync incremental e o registro ressuscita no próximo pull.

**Nome explícito pra não escorregar:** isto é um ponto intermediário. **Não** é sync engine (PowerSync/ElectricSQL/RxDB) — essa opção custa 1-2 semanas + serviço externo + migrations nos dois lados, e paga complexidade de multi-device por um problema que não existe. Só se um dia entrar Apple Watch ou segundo aparelho.

---

## D-008 — A tela de sessão ativa inverte o default do projeto
**10/09/2026**

"Server Components por padrão, Server Actions pra mutation" vale pro app inteiro **menos** a tela de treino, que é Client Component com estado local e persistência em IndexedDB. Round-trip por série é incompatível com o uso.

Registrado aqui porque é exatamente o tipo de coisa que alguém (inclusive eu, em dois meses) "corrige" de volta pro padrão e quebra o app.

---

## D-009 — Persistência de sessão é requisito de produto
**10/09/2026**

Uso diário no iPhone. Pedir login toda semana = o app deixa de ser aberto.

- **Cookie posto pelo servidor** (`@supabase/ssr` + refresh no middleware). O ITP do Safari corta cookie escrito por JS em 7 dias; `Set-Cookie` do servidor não sofre esse teto.
- "Time-box user sessions" e "inactivity timeout" **desligados** no painel.
- **O gate de auth não fica na frente do shell offline.** Falha de refresh bloqueia sync, nunca uso. Middleware **não** redireciona a rota de sessão pra `/login` — isso mataria D-006 inteiro.
- **iOS:** PWA instalado tem storage separado do Safari. Instalar primeiro, logar dentro do app.

---

## D-010 — Alimentos: TACO embarcado + Open Food Facts sob demanda
**10/09/2026**

Combinação assimétrica, não escolha entre os dois.

- **TACO** (~600 alimentos, UNICAMP, análise laboratorial) vira **seed** no repo, `verificado = true`. Cobre a base da dieta brasileira, offline pra sempre. Extensão natural depois: TBCA/USP (~2.000).
- **Open Food Facts** só como **lookup sob demanda** por código de barras/busca, com **cache-on-write**: o resultado é copiado pra tabela local (`fonte='off'`, `verificado=false`) e resolve offline pra sempre. **Nunca importar em lote** (~4M produtos não cabem no free tier e nem deveriam).
- **Manual** como terceira fonte, sem fricção.

**Contra do OFF (colaborativo, dado errado é comum):** mitigado pela coluna gerada `kcal_calc = 4·prot + 4·carbo + 9·gord` — a UI marca em âmbar quando diverge >20% do `kcal_100` declarado. Detector de lixo de graça.

**Licenças:** OFF é ODbL (atribuição na redistribuição; uso pessoal sem redistribuir, tranquilo). TACO é publicação UNICAMP/NEPA, mesma leitura.

---

## D-011 — Snapshot de nutrientes no item, nunca referência viva
**10/09/2026**

`refeicao_itens` guarda `kcal_100_snap`, `proteina_100_snap`, etc., e os macros são **colunas geradas sobre o snapshot**. Padrão copiado de `reforma_simulacao_itens` no leilões-app.

Sem isso, uma correção no Open Food Facts (ou na sua própria edição do alimento) **reescreve seu histórico em silêncio**. Mesma lógica pra receitas: logar uma receita **expande em itens**, não referencia a receita.

---

## D-012 — `data_local date` separada do `timestamptz`
**10/09/2026**

Gravada **pelo client**. Sem ela, a janta das 22h no Brasil vira o dia seguinte em UTC — e o servidor da Vercel roda em UTC (o leilões-app já apanhou disso).

Agrupar por `date(ts at time zone 'America/Sao_Paulo')` também funcionaria, mas obriga a repetir o fuso em toda query e mata índice. Coluna explícita é mais barata.

---

## D-013 — Sem tabela `refeicoes`; `refeicao_itens` é plano
**10/09/2026**

Refeição é enum fixo de ~5 slots por dia. Uma tabela pai seria ~5 linhas/dia de overhead, mais um pai pra criar antes de cada insert offline, mais um caso de órfão pra tratar.

**Reabrir se:** você quiser nota e horário **por refeição** (não por item). Hoje não se justifica.

---

## D-014 — Catálogo de exercícios: importa primeiro, semeia depois
**10/09/2026**

Seed do **`yuhonas/free-exercise-db`** (~870 exercícios, **Unlicense** = domínio público, com `primaryMuscles`/`equipment`/`force`/`level`), filtrado pra ~120-150 e traduzido pra pt-BR. O **wger** (CC-BY-SA, pt-BR parcial) entra só como conferência de nomes. O trabalho real do seed é tradução, não coleta.

**Ordem importa:** a importação do histórico do Heavy roda **antes** do seed. Os nomes do Heavy viram os canônicos (são os que o usuário usa), e o seed **só insere o que não casou** por `nome_busca` normalizado; ambíguos o script imprime pra confirmação manual, em vez de adivinhar.

**Risco que essa ordem evita:** seed e import descoordenados produzem "Supino Reto" e "Barbell Bench Press" como dois exercícios, com o histórico partido ao meio — e o "anterior" (D-005) quebra exatamente onde mais importa.

**A importação resolve dois terços do item:** resolve **ranking** (frequência real popula `usos`/`ultimo_uso_em`, então a busca ordena certo no dia 1) e **nomenclatura**. Não resolve **cobertura** — a máquina nova de mês que vem não está no histórico. Por isso o seed continua.

**Plano B se o arquivo demorar:** `exercicios.fixado` + `ordem_manual` cobre o dia 1 na mão.

---

## D-015 — `series.rpe`, não `series.rir`
**10/09/2026**

O export do Heavy traz **RPE**. Converter pra RIR na importação perderia informação de graça. Guarda-se RPE (canônico); RIR = `10 − rpe` numa função pura na UI, se preferir ver assim.

---

## D-016 — Export com restore testado, semanal
**10/09/2026**

`scripts/export.ts` → `backups/AAAA-MM-DD/`, JSONL por tabela (fiel, reimportável) + CSV (planilha).

**Um export que nunca foi restaurado não é backup.** O primeiro restore num projeto Supabase vazio é tarefa executada, não intenção.

Roda como tarefa agendada semanal. De quebra **mantém o free tier acordado** — a pausa é por 7 dias de inatividade.
