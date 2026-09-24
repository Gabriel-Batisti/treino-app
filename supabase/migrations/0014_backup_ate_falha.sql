-- 0014_backup_ate_falha.sql
-- A série backup vai até a falha, ou tem alvo de reps como as outras?
--
-- RODAR MANUALMENTE no SQL editor do Supabase. Depois:
--   npx supabase gen types typescript --project-id <ref> > types/database.ts
--
-- POR QUE ISTO EXISTE:
-- a tela da rotina escrevia "até a falha" FIXO em toda linha de backup. Era
-- verdade enquanto o único backup era o do supino (−30% e até a falha). Deixou
-- de ser no primeiro Muscle Round: lá os blocos do drop têm alvo de 4 reps
-- iguais aos outros, e a tela passou a prometer falha em bloco que não falha.
--
-- Número inventado na UI é pior que campo faltando: ninguém questiona o que
-- está escrito na tela.
--
-- `reps_alvo_min/max` continua sendo o alvo das séries de trabalho E das
-- backups que têm alvo. Quando esta coluna é true, a backup ignora a faixa —
-- é até a falha, e alvo de reps ali não significaria nada.

alter table rotina_exercicios
  add column if not exists backup_ate_falha boolean not null default false;

comment on column rotina_exercicios.backup_ate_falha is
  'true = a série backup vai até a falha e ignora reps_alvo. false = ela tem
   o mesmo alvo de reps das demais (caso do Muscle Round, onde os blocos do
   drop também são de 4 reps).';
