-- 0007_push.sql
-- Inscrições de Web Push, pro lembrete diário de pesagem.
--
-- RODAR MANUALMENTE no SQL editor do Supabase. Depois:
--   npx supabase gen types typescript --project-id <ref> > types/database.ts
--
-- POR QUE UMA TABELA: a inscrição do Web Push é um endpoint gerado pelo
-- navegador junto com duas chaves. Quem manda a notificação é o servidor, no
-- cron — então o dado precisa estar no banco, não no aparelho.
--
-- UMA LINHA POR APARELHO. iPhone instalado, Safari do Mac e Chrome do PC são
-- inscrições diferentes, e apagar uma não pode derrubar as outras.

create table if not exists push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- O endpoint é o identificador de verdade: o navegador troca de endpoint
  -- quando a inscrição expira, e reinscrever tem que criar linha nova.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  apelido text,
  criado_em timestamptz not null default now(),
  ultimo_envio_em timestamptz,
  -- Push que falha com 404/410 está morto (app desinstalado). Some na hora,
  -- e não fica pendurado fazendo o cron gastar tempo todo dia.
  falhas integer not null default 0
);

create index if not exists push_inscricoes_user_idx on push_inscricoes (user_id);

alter table push_inscricoes enable row level security;

drop policy if exists "push do dono" on push_inscricoes;
create policy "push do dono" on push_inscricoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table push_inscricoes is
  'Aparelhos inscritos pra receber lembrete. Uma linha por navegador/aparelho.';
