-- 0006_sessao_apple.sql
-- Batimentos e calorias do Apple Watch dentro do treino de musculação.
--
-- RODAR MANUALMENTE no SQL editor do Supabase. Depois:
--   npx supabase gen types typescript --project-id <ref> > types/database.ts
--
-- POR QUE: o usuário registra a musculação como "Outro" no Apple Watch. Filtrar
-- treino de força pelo NOME do tipo (o que a 0005 fazia) não funciona pra ele —
-- "Outro" viraria um cardio falso por cima de cada treino de academia.
--
-- A solução é melhor que o filtro: em vez de IGNORAR o treino de força, casar
-- com a sessão do app pelo horário e anexar as métricas nela. Aí o tipo do
-- relógio deixa de importar.

alter table sessoes add column if not exists fc_media integer
  check (fc_media is null or (fc_media > 20 and fc_media < 260));
alter table sessoes add column if not exists fc_max integer
  check (fc_max is null or (fc_max > 20 and fc_max < 260));
alter table sessoes add column if not exists calorias integer
  check (calorias is null or (calorias >= 0 and calorias <= 5000));

-- Id do treino no Apple Saúde que foi casado com esta sessão. Serve pra não
-- anexar duas vezes e pra rastrear de onde vieram os números.
alter table sessoes add column if not exists apple_origem_id text;

drop index if exists sessoes_apple_uidx;
create unique index sessoes_apple_uidx
  on sessoes (user_id, apple_origem_id) where apple_origem_id is not null;

comment on column sessoes.fc_media is
  'Frequência cardíaca média do Apple Watch, anexada por casamento de horário.';
comment on column sessoes.apple_origem_id is
  'Treino do Apple Saúde já absorvido por esta sessão. Evita anexar duas vezes.';
