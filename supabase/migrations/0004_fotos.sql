-- 0004_fotos.sql
-- Fotos de acompanhamento (progresso).
--
-- RODAR MANUALMENTE no SQL editor do Supabase, DEPOIS da 0003. Em seguida:
--   npx supabase gen types typescript --project-id <ref> > types/database.ts
--
-- TABELA PRÓPRIA, e não coluna em `medidas`: acompanhamento tem mais de uma
-- foto por dia (frente, lado, costas) e nem toda foto vem com pesagem. Uma
-- coluna `foto_path` em medidas permitiria exatamente uma.
--
-- A ligação com o peso é POR DATA, sem FK: assim dá pra fotografar sem pesar e
-- pesar sem fotografar, e a tela junta os dois quando os dois existem.
--
-- Segue as mesmas regras (ver DECISIONS.md):
--   D-007  id do client, `atualizado_em`, exclusão por `excluido_em`
--   D-012  `data_local` gravada pelo client

create table if not exists fotos (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,

  tirada_em timestamptz not null,
  data_local date not null,

  angulo text not null default 'frente'
    check (angulo in ('frente', 'lado', 'costas', 'outro')),

  -- Caminho no bucket `fotos`, não URL: URL assinada expira.
  arquivo_path text not null,
  -- Guardado pra a galeria reservar o espaço certo antes da imagem chegar.
  largura integer check (largura > 0),
  altura integer check (altura > 0),
  notas text,

  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table fotos is
  'Fotos de acompanhamento. Ligadas ao peso por data_local, sem FK: dá pra
   fotografar sem pesar e vice-versa.';

alter table fotos enable row level security;

-- drop antes de criar: esta migration é re-executável de ponta a ponta.
drop policy if exists "own_fotos" on fotos;
create policy "own_fotos" on fotos for all
  using (user_id = auth.uid());

create index if not exists fotos_data_idx
  on fotos (user_id, data_local desc) where excluido_em is null;
create index if not exists fotos_delta_idx
  on fotos (user_id, atualizado_em);

drop trigger if exists fotos_set_updated_at on fotos;
create trigger fotos_set_updated_at before update on fotos
  for each row execute function set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- Storage das fotos
-- ─────────────────────────────────────────────────────────────────────────────
-- Bucket PRIVADO e SEPARADO do de bioimpedância. Não é frescura: foto de corpo
-- é o dado mais sensível do app, e bucket separado permite apagar ou endurecer
-- um sem mexer no outro.
--
-- Convenção de caminho: <user_id>/<uuid>.jpg — a primeira pasta é o dono, e é
-- nela que as políticas se apoiam.

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

drop policy if exists "fotos_own_select" on storage.objects;
create policy "fotos_own_select" on storage.objects for select
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fotos_own_insert" on storage.objects;
create policy "fotos_own_insert" on storage.objects for insert
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fotos_own_delete" on storage.objects;
create policy "fotos_own_delete" on storage.objects for delete
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
