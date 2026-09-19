# Fila — o que ficou pra depois

Pedido enquanto o app está em uso real. **Nada aqui entra no meio de um treino.**

Ordem de entrada na fila ≠ ordem de execução. A regra que manda continua sendo
a do `CLAUDE.md`: **treino ponta a ponta → 3 semanas de uso real → dieta**.

---

## 1. Motor de progressão — o app sugerir a carga de hoje
**Anotado em 18/09/2026 · a mais valiosa da fila**

Hoje o app mostra o **anterior** (D-005). O passo seguinte é ele dizer *"hoje é
85 kg"*. É determinístico — cai na regra do botão, não na de conversa
(`APRENDIZADOS.md`).

Referência de desenho: [`progression.js`](https://github.com/arvids-unavailable/openGym/blob/main/frontend/src/lib/progression.js)
do openGym. Cinco políticas:

| Política | Regra |
|---|---|
| Off | o alvo fica onde você pôs |
| Linear | bateu todas as reps em todas as séries → sobe o incremento; 3 falhas seguidas → deload a 90% |
| Greyskull LP | 2 séries + AMRAP final; bateu o alvo na última → sobe; dobrou o alvo → salto duplo; 1 falha → deload de 10% |
| Dupla progressão | faixa de reps com peso fixo; topo da faixa em todas as séries → sobe o peso e volta pro piso |
| Tempo | segurou a duração em todas as séries → o alvo sobe (prancha, barra estática) |

**O acerto de desenho dele, que vale copiar:** a recomendação é **derivada do
histórico, nunca guardada na sessão concluída**. Trocar de política não
reescreve o passado, e não existe estado pra dessincronizar. Bate com a regra da
fórmula única em `lib/*/calc.ts`.

Exercício de peso corporal (carga zero) progride em **reps ou número de séries**,
não em carga — com teto de séries pra não virar maratona.

> ⚠ **O openGym é AGPL-3.0.** Copiar código de lá obriga este app a virar AGPL.
> **Não copiar uma linha** — reimplementar do conceito. As políticas em si são
> programas de treino publicados (Greyskull LP é literatura, não invenção deles);
> o que é AGPL é o arquivo, não a ideia.

**Pré-requisito:** faixa de reps alvo por exercício na rotina. Já existe
(`rotina_exercicios.reps_alvo_min/max`).

---

## 2. Trocar as ilustrações por GIFs de verdade
**Perguntado em 12/09/2026, fonte achada em 18/09/2026**

Hoje são **duas fotos alternadas em CSS** (`lib/treino/ilustracoes.ts`, geradas
por `scripts/baixar-ilustracoes.py` a partir de
[`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db),
~870 exercícios, **Unlicense**).

Fonte candidata: [`hasaneyldrm/exercises-dataset`](https://github.com/hasaneyldrm/exercises-dataset)
— **1.324 exercícios**, GIF animado + thumbnail 180×180, com `body_part`,
`equipment`, `target`, `secondary_muscles` e instruções em 10 idiomas.

**O ganho principal não é a animação, é a cobertura.** Com 1.324 em vez de 870,
sobram menos exercícios seus marcados como `aprox: true` ("ilustração
aproximada"). Os `secondary_muscles` também alimentariam melhor o
`sugerirSubstitutos()` de `lib/treino/substituir.ts`.

> ⚠ **A licença é pior que a atual, e isso muda o procedimento.** O código e os
> textos são MIT, mas **as mídias são © Gym Visual**, redistribuídas "com
> permissão" a 180×180 e com atribuição obrigatória. Essa permissão é uma
> afirmação do README daquele repo — não verificada, e a Gym Visual vende esses
> GIFs comercialmente. O nosso atual é domínio público.
>
> Uso pessoal no app: risco perto de zero. **Commitar os arquivos num repo
> público é redistribuir.** Então, antes de qualquer coisa: **fechar o repo**,
> ou baixar em script e deixar os binários fora do git (como já se faz com
> `data/`).

**Outros cuidados:**
- 180×180 serve bem pras miniaturas do treino (36–40px) e fica apertado na tela
  de detalhe do exercício. Pode valer manter as fotos atuais lá.
- Casar 1.324 nomes com os 48 canônicos é o mesmo trabalho do D-014, e a mesma
  regra vale: **na dúvida, não junte**.
- GIF animado rodando sete vezes na tela de sessão ativa é o cuidado que já
  estava anotado aqui. Miniatura na sessão fica **estática**; o GIF é da tela de
  detalhe e do seletor de substituição.

---

## 3. Superset e exercício por tempo
**Anotado em 18/09/2026 · pequeno**

O openGym tem os dois. O nosso schema **já prevê** exercício por tempo
(`exercicios.modo_medicao = 'tempo'`, e `series.duracao_seg` existe) — falta só
a UI da linha de série renderizar cronômetro em vez de peso × reps.

Superset (dois exercícios alternados como um bloco) não existe em lugar nenhum
ainda: precisaria de um agrupamento em `sessao_exercicios`.

---

## 4. Treino na tela de bloqueio, como o Heavy
**Pedido em 12/09/2026 · ⚠ NÃO é possível como PWA**

O Heavy mostra o treino em andamento na tela de bloqueio, com exercício atual,
série e um botão de concluir. Isso é **Live Activity** (ActivityKit): API
nativa do iOS, disponível só pra app do App Store. **Não existe API web** —
nem no app instalado na tela de início. O mesmo vale pra widget de tela de
início e pra Dynamic Island.

**O que dá pra fazer, e não é a mesma coisa:**
- **Notificação persistente** durante o treino, atualizada a cada série. Aparece
  na lista de notificações, não como painel vivo, e depende do Web Push (já
  montado, ver D-020).
- Manter a tela acesa no treino (`navigator.wakeLock`, já implementado).

**O que seria preciso pra ter de verdade:** o plano B do D-001 — empacotar em
Expo/React Native. É a troca que o D-001 já previa, e o custo continua sendo o
mesmo: deixar de ser web.

---

## Saiu da fila

- **Miniatura do exercício na sessão ativa** — pedida em 12/09, feita em 12/09.
  Foto estática, não a alternância de duas, pelo motivo que estava anotado aqui.

## Olhado e descartado

- **openGym, o resto do repo** ([arvids-unavailable/openGym](https://github.com/arvids-unavailable/openGym)):
  React 19 + Vite, backend Node sem framework, **dados em arquivos JSON** e
  Docker self-hosted. Passkey (WebAuthn) no login, 12 idiomas, APK Android,
  importadores de FitNotes/Strong/Hevy/Apple Health.

  Nada a aproveitar da arquitetura: JSON em disco é pior que Postgres com RLS, e
  self-host em container troca o deploy de graça da Vercel por um servidor pra
  cuidar. O login por passkey é bonito, mas o D-009 já resolveu "o app não pode
  me deslogar" com cookie posto pelo servidor. O importador do Hevy a gente já
  tem (D-014).

  **O que sobrou de útil está nos itens 1, 2 e 3 acima.**
