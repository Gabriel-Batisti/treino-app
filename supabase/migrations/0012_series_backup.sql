-- 0012_series_backup.sql
-- Quantas das séries da rotina são "backup" (backoff).
--
-- RODAR MANUALMENTE no SQL editor do Supabase. Depois:
--   npx supabase gen types typescript --project-id <ref> > types/database.ts
--
-- POR QUE UMA COLUNA, E NÃO UM TEXTO NA NOTA:
-- `series.tipo` já aceita 'backoff' desde a 0001 — o que faltava era a ROTINA
-- saber que a última série nasce assim. Sem isso, você teria que marcar à mão
-- toda vez, no meio do treino, que é exatamente onde o app não pode pedir
-- trabalho extra.
--
-- É CONTAGEM, não booleano: "as N últimas são backup". Um `tem_backup boolean`
-- resolveria o caso de hoje (2 de trabalho + 1 backup) e travaria no primeiro
-- exercício com duas backups.
--
-- O alvo de reps (`reps_alvo_min/max`) continua sendo o das séries de
-- TRABALHO. Backup costuma ser até a falha, então alvo de reps ali não
-- significa nada — quem descreve a regra dela é `notas`.

alter table rotina_exercicios
  add column if not exists series_backup integer not null default 0
  check (series_backup >= 0);

-- Percentual da carga da ÚLTIMA SÉRIE DE TRABALHO que a backup sugere.
-- "30% a menos" vira 70. Guardado como percentual, e não como "menos 30",
-- porque é assim que a conta é feita: peso × pct / 100.
--
-- Coluna, e não 70 fixo no código: o próximo exercício pode pedir −20%, e
-- número mágico espalhado pelo TypeScript é o que faz a prescrição do coach
-- virar folclore.
alter table rotina_exercicios
  add column if not exists backup_pct_carga integer
  check (backup_pct_carga is null or (backup_pct_carga > 0 and backup_pct_carga <= 100));

-- Descanso ANTES da backup — ou seja, o que corre quando a PRÓXIMA série é
-- uma backup. No protocolo, 30s: é descanso curto de propósito, pra chegar na
-- backup ainda fatigado. Nada a ver com o descanso entre as séries de
-- trabalho, que continua em `descanso_seg`.
alter table rotina_exercicios
  add column if not exists backup_descanso_seg integer
  check (backup_descanso_seg is null or (backup_descanso_seg >= 0 and backup_descanso_seg <= 900));

comment on column rotina_exercicios.series_backup is
  'Quantas das últimas séries são backup (backoff). Contadas DENTRO de
   series_alvo: 2 de trabalho + 1 backup = series_alvo 3, series_backup 1.';

comment on column rotina_exercicios.backup_pct_carga is
  'Percentual da carga da última série de trabalho sugerido pra backup.
   70 = "30% a menos". Null = sem sugestão automática.';

comment on column rotina_exercicios.backup_descanso_seg is
  'Descanso quando a PRÓXIMA série é backup. Curto de propósito. Null = usa
   descanso_seg, o mesmo das séries de trabalho.';

comment on column rotina_exercicios.notas is
  'Prescrição que não cabe em número: protocolo de aproximação (aquecimento,
   preparatória, reconhecimento) e a regra da backup. Séries de aproximação
   NÃO viram linha gravada — não entram em volume nem em recorde, então
   carga ali seria número sem uso.';
