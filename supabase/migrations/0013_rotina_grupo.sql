-- 0013_rotina_grupo.sql
-- A rotina passa a ser o CONJUNTO; cada linha de `rotinas` é um treino dele.
--
-- RODAR MANUALMENTE no SQL editor do Supabase. Depois:
--   npx supabase gen types typescript --project-id <ref> > types/database.ts
--
-- O PROBLEMA DE VOCABULÁRIO QUE ISTO CONSERTA:
-- a tabela `rotinas` sempre guardou UM TREINO por linha ("Treino A", "Treino
-- B"), e a tela chamava essa lista de "Rotinas". Só que rotina, pra quem
-- treina, é o programa inteiro — "Musclelab", com os treinos A a E dentro. O
-- app tinha um nível onde o usuário tem dois, e isso apareceu na primeira vez
-- que um programa novo precisou entrar.
--
-- COLUNA DE TEXTO, E NÃO TABELA `programas`:
-- um pai traria CRUD próprio, FK, RLS, sync e tela de edição — e entregaria,
-- de concreto, agrupamento na lista e arquivar em bloco. As duas coisas saem
-- de um text. Mesmo raciocínio do D-013, que recusou a tabela `refeicoes`.
--
-- Reabrir se: o programa precisar de dado PRÓPRIO (data de início, semanas,
-- progressão, observação do coach). Aí o pai deixa de ser só um rótulo e passa
-- a ter conteúdo, e a tabela se paga.

alter table rotinas add column if not exists grupo text;

comment on column rotinas.grupo is
  'Nome do programa a que este treino pertence ("Musclelab 2"). Null = treino
   solto. É rótulo, não FK: renomear o programa é um update em N linhas, e
   não existe dado próprio de programa que justifique uma tabela (D-013).';

-- Agrupa a listagem sem varrer a tabela quando houver muitos programas.
create index if not exists rotinas_grupo_idx
  on rotinas (user_id, grupo, ordem) where arquivada = false;
