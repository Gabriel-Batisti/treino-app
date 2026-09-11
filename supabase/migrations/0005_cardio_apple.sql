-- 0005_cardio_apple.sql
-- Campos que vêm do Apple Watch e não existiam em `cardios`.
--
-- RODAR MANUALMENTE no SQL editor do Supabase. Depois:
--   npx supabase gen types typescript --project-id <ref> > types/database.ts
--
-- Esta migration é NECESSÁRIA, diferente da que eu descartei antes: não há
-- coluna nenhuma onde encaixar frequência cardíaca. Guardar em `notas` como
-- texto tiraria a possibilidade de gráfico e de comparação.

alter table cardios add column if not exists fc_media integer
  check (fc_media is null or (fc_media > 20 and fc_media < 260));
alter table cardios add column if not exists fc_max integer
  check (fc_max is null or (fc_max > 20 and fc_max < 260));

-- De onde veio o registro. Serve pra a tela dizer "do Apple Watch" e, mais
-- importante, pra saber o que NÃO editar à mão sem perder a origem.
alter table cardios add column if not exists fonte text not null default 'manual';
alter table cardios drop constraint if exists cardios_fonte_check;
alter table cardios add constraint cardios_fonte_check
  check (fonte in ('manual', 'apple_saude'));

-- Identificador do treino no app Saúde. É o que torna o reenvio idempotente:
-- se a automação disparar duas vezes, cai na mesma linha em vez de duplicar.
alter table cardios add column if not exists origem_id text;

drop index if exists cardios_origem_uidx;
create unique index cardios_origem_uidx
  on cardios (user_id, origem_id) where origem_id is not null;

comment on column cardios.origem_id is
  'Id do treino na origem (Apple Saúde). Unique parcial: reenvio não duplica.';

comment on column cardios.fc_media is
  'Frequência cardíaca média, em bpm. Vem do Apple Watch; nulo no registro manual.';
