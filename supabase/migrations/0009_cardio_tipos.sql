-- 0009_cardio_tipos.sql
-- Bike externa e futebol na lista de cardio.
--
-- RODAR MANUALMENTE no SQL editor do Supabase. Depois:
--   npx supabase gen types typescript --project-id <ref> > types/database.ts
--
-- POR QUE PRECISA DE MIGRATION: `cardios.tipo` tem lista fechada no banco
-- (check constraint). A lista fechada é de propósito — sem ela, "Bike",
-- "bike" e "Bicicleta" viravam três tipos e o histórico deixava de somar.
--
-- `bicicleta` continua significando a de dentro da academia, que é o que os
-- registros existentes são. A nova é explícita: `bicicleta_externa`.

alter table cardios drop constraint if exists cardios_tipo_check;

alter table cardios add constraint cardios_tipo_check check (tipo in (
  'esteira','bicicleta','bicicleta_externa','eliptico','escada',
  'remo','corrida','caminhada','futebol','outro'
));

comment on column cardios.tipo is
  'Lista fechada. bicicleta = ergométrica/spinning; bicicleta_externa = na rua.';
