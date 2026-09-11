-- 0003_medidas.sql
-- Peso diário + bioimpedância.
--
-- RODAR MANUALMENTE no SQL editor do Supabase. Depois:
--   npx supabase gen types typescript --project-id <ref> > types/database.ts
--
-- UMA TABELA SÓ, e não duas: a bioimpedância também pesa. Em tabelas separadas,
-- a série de peso do gráfico ficaria partida entre as duas e toda query viraria
-- um union. Aqui, pesagem diária preenche `peso_kg` e ponto; bioimpedância
-- preenche o resto das colunas e anexa o arquivo.
--
-- Segue as mesmas regras (ver DECISIONS.md):
--   D-003  coluna gerada = aritmética imutável da própria linha
--   D-007  id do client, `atualizado_em`, exclusão por `excluido_em`
--   D-012  `data_local` gravada pelo client, separada do timestamptz

create table if not exists medidas (
  -- SEM default: id vem do client (D-007). A pesagem do dia usa id determinístico
  -- derivado da data, então registrar de novo no mesmo dia CORRIGE em vez de
  -- duplicar — sem precisar de unique index nem de "editar" na UI.
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,

  origem text not null default 'manual'
    check (origem in ('manual', 'bioimpedancia')),

  medido_em timestamptz not null,
  -- Do relógio do celular: pesagem às 23h não pode cair no dia seguinte (D-012).
  data_local date not null,

  peso_kg numeric not null check (peso_kg > 20 and peso_kg < 400),

  -- Tudo abaixo é da bioimpedância e opcional. Pesagem diária deixa em branco.
  gordura_pct numeric check (gordura_pct >= 0 and gordura_pct <= 75),
  massa_magra_kg numeric check (massa_magra_kg >= 0),
  massa_muscular_kg numeric check (massa_muscular_kg >= 0),
  agua_pct numeric check (agua_pct >= 0 and agua_pct <= 100),
  gordura_visceral numeric check (gordura_visceral >= 0),
  tmb_kcal integer check (tmb_kcal >= 0),
  cintura_cm numeric check (cintura_cm > 0),

  -- Caminho no Storage (bucket `bioimpedancia`), não URL: URL assinada expira.
  arquivo_path text,
  notas text,

  -- Aritmética imutável da própria linha (D-003). Evita recalcular no gráfico
  -- e deixa ordenar por massa gorda direto no SQL.
  massa_gorda_kg numeric generated always as (
    case when gordura_pct is not null
         then round(peso_kg * gordura_pct / 100, 2) end
  ) stored,

  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table medidas is
  'Pesagem diária e bioimpedância na mesma tabela: a bioimpedância também pesa,
   e separar partiria a série do gráfico em duas.';

comment on column medidas.arquivo_path is
  'Caminho no bucket `bioimpedancia` (<user_id>/<arquivo>). Guardamos o caminho
   e não a URL porque URL assinada expira.';

alter table medidas enable row level security;

-- drop antes de criar: esta migration é re-executável de ponta a ponta.
drop policy if exists "own_medidas" on medidas;
create policy "own_medidas" on medidas for all
  using (user_id = auth.uid());

create index if not exists medidas_data_idx
  on medidas (user_id, data_local desc) where excluido_em is null;
create index if not exists medidas_delta_idx
  on medidas (user_id, atualizado_em);

drop trigger if exists medidas_set_updated_at on medidas;
create trigger medidas_set_updated_at before update on medidas
  for each row execute function set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- Storage do exame de bioimpedância
-- ─────────────────────────────────────────────────────────────────────────────
-- Bucket PRIVADO. O app lê por URL assinada de curta duração; um bucket público
-- deixaria o exame acessível a quem adivinhasse o caminho.
--
-- Convenção de caminho: <user_id>/<uuid>.<ext> — a primeira pasta é o dono, e é
-- nela que as políticas se apoiam.

insert into storage.buckets (id, name, public)
values ('bioimpedancia', 'bioimpedancia', false)
on conflict (id) do nothing;

drop policy if exists "bioimpedancia_own_select" on storage.objects;
create policy "bioimpedancia_own_select" on storage.objects for select
  using (
    bucket_id = 'bioimpedancia'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "bioimpedancia_own_insert" on storage.objects;
create policy "bioimpedancia_own_insert" on storage.objects for insert
  with check (
    bucket_id = 'bioimpedancia'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "bioimpedancia_own_delete" on storage.objects;
create policy "bioimpedancia_own_delete" on storage.objects for delete
  using (
    bucket_id = 'bioimpedancia'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
