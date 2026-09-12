-- 0008_relogio.sql
-- Memória do início do treino no relógio.
--
-- RODAR MANUALMENTE no SQL editor do Supabase.
--
-- POR QUE ISTO EXISTE: o Atalhos do iOS 26 NÃO sabe ler um treino do Apple
-- Saúde — não há tipo de amostra "treino" nem ação que leia seus detalhes
-- (verificado no aparelho: seções E e T da lista de tipos completas, sem
-- "Exercício" nem "Treino"). O que ele sabe ler é frequência cardíaca e
-- energia ativa DENTRO DE UM INTERVALO.
--
-- Falta então o intervalo. A automação "ao iniciar exercício" grava o instante
-- aqui; a automação "ao encerrar" pergunta por ele e usa como limite inferior
-- da busca. O servidor é a memória que o Atalhos não tem.

create table if not exists relogio_inicios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  inicio_em timestamptz not null,
  -- Marcado quando a automação de fim consome este início. Guardado em vez de
  -- apagado: se o fim falhar e for reenviado, dá pra saber o que aconteceu.
  consumido_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists relogio_inicios_user_idx
  on relogio_inicios (user_id, criado_em desc);

alter table relogio_inicios enable row level security;

drop policy if exists "relogio do dono" on relogio_inicios;
create policy "relogio do dono" on relogio_inicios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table relogio_inicios is
  'Instante em que um treino começou no Apple Watch. Ver 0008 e D-021.';
