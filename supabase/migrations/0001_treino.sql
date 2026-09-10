-- 0001_treino.sql
-- Fundação do treino. Dieta fica pra 0002, depois de 3 semanas de uso real
-- (ordem fixada em DECISIONS.md; tabela morta gera tipo morto).
--
-- RODAR MANUALMENTE no SQL editor do Supabase, projeto em sa-east-1 (D-002).
-- Depois: `supabase gen types typescript` — os tipos marcam coluna gerada
-- como read-only no Insert/Update, que é metade da proteção do D-003.
--
-- Convenções desta migration (ver DECISIONS.md):
--   D-003  coluna gerada = aritmética imutável da própria linha, e nada mais
--   D-004  e1RM por Brzycki, com teto em 12 reps
--   D-005  "anterior" por (exercicio_id, indice) — vw_ultimo_desempenho
--   D-007  atualizado_em em tudo (sync delta) e PROIBIDO hard delete
--   D-012  data_local separada do timestamptz
--   D-015  rpe, não rir
--
-- Regra de exclusão, uma linha só:
--   catálogo (exercicios, rotinas) usa `arquivado`;
--   linha filha (rotina_exercicios, sessao_exercicios, series) usa `excluido_em`.
--   Um `delete` é invisível pro sync delta e o registro ressuscita no pull.

-- pg_trgm: usado pelo script de importação do Heavy pra casar nome do export
-- com nome do catálogo por similaridade (D-014). Não é enfeite.
create extension if not exists pg_trgm;

create or replace function set_updated_at() returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;


-- ─────────────────────────────────────────────────────────────────────────────
-- exercicios — catálogo
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists exercicios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,

  nome text not null,
  -- Normalizado (minúsculo, sem acento). Calculado em TypeScript, NUNCA aqui:
  -- unaccent() é STABLE, não IMMUTABLE, e não serve pra coluna gerada — o
  -- workaround é um wrapper marcado immutable na marra, que mente. E o client
  -- precisa da mesma normalização pra busca offline, então a fórmula tem que
  -- morar no TS de qualquer jeito. Uma implementação só (lib/treino/texto.ts).
  nome_busca text not null,

  grupo_muscular text,
  equipamento text,

  -- Decide qual UI a linha de série renderiza. Sem isto, prancha e supino
  -- disputam o mesmo formulário.
  modo_medicao text not null default 'peso_reps'
    check (modo_medicao in ('peso_reps','peso_corporal_reps','tempo','distancia')),

  unilateral boolean not null default false,

  fonte text not null default 'manual'
    check (fonte in ('seed','importado_heavy','manual')),

  -- Ranking da busca. Populados pela importação do Heavy no dia 1 (D-014).
  usos integer not null default 0 check (usos >= 0),
  ultimo_uso_em timestamptz,
  favorito boolean not null default false,
  -- Plano B de ranking, se a importação atrasar.
  fixado boolean not null default false,
  ordem_manual integer,

  notas text,
  arquivado boolean not null default false,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table exercicios is
  'Catálogo de exercícios. Nomes canônicos vêm da importação do Heavy; o seed
   (free-exercise-db) só insere o que não casou por nome_busca — ver D-014.';

alter table exercicios enable row level security;
create policy "own_exercicios" on exercicios for all
  using (user_id = auth.uid());

-- Dedupe: é esta constraint que impede "Supino Reto" e "Barbell Bench Press"
-- coexistirem com o histórico partido ao meio (o risco central do D-014).
create unique index if not exists exercicios_nome_busca_uidx
  on exercicios (user_id, nome_busca) where arquivado = false;
create index if not exists exercicios_nome_trgm_idx
  on exercicios using gin (nome_busca gin_trgm_ops);
create index if not exists exercicios_ranking_idx
  on exercicios (user_id, fixado desc, ultimo_uso_em desc nulls last, usos desc)
  where arquivado = false;
create index if not exists exercicios_delta_idx
  on exercicios (user_id, atualizado_em);

create trigger exercicios_set_updated_at before update on exercicios
  for each row execute function set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- rotinas
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists rotinas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  notas text,
  ordem integer not null default 0,
  arquivada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table rotinas enable row level security;
create policy "own_rotinas" on rotinas for all
  using (user_id = auth.uid());

create index if not exists rotinas_ordem_idx
  on rotinas (user_id, ordem) where arquivada = false;
create index if not exists rotinas_delta_idx
  on rotinas (user_id, atualizado_em);

create trigger rotinas_set_updated_at before update on rotinas
  for each row execute function set_updated_at();


create table if not exists rotina_exercicios (
  id uuid primary key default gen_random_uuid(),
  rotina_id uuid not null references rotinas on delete cascade,
  exercicio_id uuid not null references exercicios on delete restrict,

  ordem integer not null default 0,
  series_alvo integer check (series_alvo > 0),
  reps_alvo_min integer check (reps_alvo_min > 0),
  reps_alvo_max integer check (reps_alvo_max > 0),
  descanso_seg integer check (descanso_seg >= 0),
  -- Mesma letra = bi-set/superset.
  superset_grupo text,
  notas text,

  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  check (reps_alvo_max is null or reps_alvo_min is null or reps_alvo_max >= reps_alvo_min)
);

alter table rotina_exercicios enable row level security;
create policy "own_rotina_exercicios" on rotina_exercicios for all using (
  exists (select 1 from rotinas r
          where r.id = rotina_exercicios.rotina_id and r.user_id = auth.uid())
);

create index if not exists rotina_exercicios_ordem_idx
  on rotina_exercicios (rotina_id, ordem) where excluido_em is null;
create index if not exists rotina_exercicios_delta_idx
  on rotina_exercicios (atualizado_em);

create trigger rotina_exercicios_set_updated_at before update on rotina_exercicios
  for each row execute function set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- sessoes
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists sessoes (
  -- SEM default: o id vem do client (D-007). É o que torna o upsert idempotente
  -- e o retry seguro quando o request foi mas a resposta se perdeu. Em SQL
  -- ad-hoc, passe gen_random_uuid() explicitamente.
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,

  rotina_id uuid references rotinas on delete set null,  -- null = treino livre ou importado
  nome text,                                             -- snapshot do título

  inicio_em timestamptz not null,
  fim_em timestamptz,
  -- Gravada PELO CLIENT (D-012). Sem ela, o treino das 22h vira o dia seguinte
  -- em UTC — e o servidor da Vercel roda em UTC.
  data_local date not null,

  status text not null default 'em_andamento'
    check (status in ('em_andamento','concluida','abandonada')),
  -- Só 'concluida' alimenta o "anterior" (vw_ultimo_desempenho).

  origem text not null default 'app'
    check (origem in ('app','importado_heavy')),

  peso_corporal_kg numeric check (peso_corporal_kg > 0),
  notas text,

  -- Subtrair PRIMEIRO é o que torna isto imutável: date_part(text, interval)
  -- é immutable, date_part(text, timestamptz) é só stable (depende do fuso).
  -- Se o SQL editor recusar, jogue a coluna fora e calcule na view.
  duracao_seg integer generated always as (
    extract(epoch from (fim_em - inicio_em))::int
  ) stored,

  sincronizado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on column sessoes.origem is
  'app | importado_heavy. Rastreabilidade e chave de reimportação idempotente.';

alter table sessoes enable row level security;
create policy "own_sessoes" on sessoes for all
  using (user_id = auth.uid());

-- Reimportar o mesmo CSV do Heavy não duplica sessão.
create unique index if not exists sessoes_import_uidx
  on sessoes (user_id, inicio_em) where origem <> 'app';
-- Serve a vw_ultimo_desempenho.
create index if not exists sessoes_historico_idx
  on sessoes (user_id, status, inicio_em desc);
create index if not exists sessoes_data_local_idx
  on sessoes (user_id, data_local desc);
create index if not exists sessoes_delta_idx
  on sessoes (user_id, atualizado_em);

create trigger sessoes_set_updated_at before update on sessoes
  for each row execute function set_updated_at();


create table if not exists sessao_exercicios (
  id uuid primary key,                                   -- client (D-007)
  sessao_id uuid not null references sessoes on delete cascade,
  exercicio_id uuid not null references exercicios on delete restrict,

  ordem integer not null default 0,
  -- Snapshots: o exercício pode ser renomeado depois; o histórico não muda.
  nome_snapshot text not null,
  modo_medicao_snapshot text not null,
  -- Aqui, e não só em rotina_exercicios — senão o superset histórico se perde
  -- na importação do Heavy.
  superset_grupo text,
  notas text,

  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table sessao_exercicios is
  'Instância do exercício dentro da sessão. Existe pra trocar exercício no meio
   do treino sem editar a rotina.';

alter table sessao_exercicios enable row level security;
create policy "own_sessao_exercicios" on sessao_exercicios for all using (
  exists (select 1 from sessoes s
          where s.id = sessao_exercicios.sessao_id and s.user_id = auth.uid())
);

create index if not exists sessao_exercicios_ordem_idx
  on sessao_exercicios (sessao_id, ordem) where excluido_em is null;
create index if not exists sessao_exercicios_exercicio_idx
  on sessao_exercicios (exercicio_id);
create index if not exists sessao_exercicios_delta_idx
  on sessao_exercicios (atualizado_em);

create trigger sessao_exercicios_set_updated_at before update on sessao_exercicios
  for each row execute function set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- series
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists series (
  id uuid primary key,                                   -- client (D-007)
  sessao_exercicio_id uuid not null references sessao_exercicios on delete cascade,

  indice integer not null check (indice >= 1),
  tipo text not null default 'normal'
    check (tipo in ('normal','aquecimento','drop','falha','backoff')),

  peso_kg numeric check (peso_kg >= 0),
  reps integer check (reps >= 0),
  -- RPE, não RIR (D-015): é o que o export do Heavy traz. RIR = 10 - rpe,
  -- numa função pura na UI.
  rpe numeric(3,1) check (rpe >= 1 and rpe <= 10),
  duracao_seg integer check (duracao_seg >= 0),
  distancia_m numeric check (distancia_m >= 0),

  concluida boolean not null default false,
  -- Relógio do CELULAR, não now() do servidor: a série das 19h05 não pode
  -- registrar com o horário do sync das 20h30.
  registrada_em timestamptz not null,

  volume_kg numeric generated always as (round(peso_kg * reps, 2)) stored,

  -- D-004: Brzycki. Epley foi rejeitada por inflar 1 rep em 3,3% (100 -> 103,3)
  -- e o erro entraria NO BANCO, porque isto alimenta recorde pessoal.
  -- Brzycki é exata em 1 rep. Acima de 12, null: e1RM ali é ficção, e null é
  -- mais honesto que número inventado.
  -- peso_kg > 0 faz barra fixa e prancha caírem em null sozinhas — coluna
  -- gerada não enxerga sessao_exercicios.modo_medicao_snapshot.
  e1rm numeric generated always as (
    case when peso_kg > 0 and reps between 1 and 12
         then round(peso_kg * 36.0 / (37 - reps), 2) end
  ) stored,

  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on column series.e1rm is
  'Brzycki, null acima de 12 reps (D-004). É a ESTIMATIVA — o recorde de força
   exibido na UI é o fato: maior peso por faixa de reps.';

alter table series enable row level security;
-- Dois níveis de exists, no padrão herdado do leilões-app. Se o pull delta de
-- series ficar lento com anos de histórico, o escape é denormalizar user_id
-- aqui (migration + backfill). Não antecipar.
create policy "own_series" on series for all using (
  exists (select 1 from sessao_exercicios se
          join sessoes s on s.id = se.sessao_id
          where se.id = series.sessao_exercicio_id and s.user_id = auth.uid())
);

create unique index if not exists series_indice_uidx
  on series (sessao_exercicio_id, indice) where excluido_em is null;
create index if not exists series_delta_idx
  on series (atualizado_em);

create trigger series_set_updated_at before update on series
  for each row execute function set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- vw_ultimo_desempenho — o "anterior" (D-005)
-- ─────────────────────────────────────────────────────────────────────────────
-- Definida UMA vez aqui em vez de reescrita no sync, no import e na tela.
-- O caminho de leitura do app é o IndexedDB (D-007); esta view serve o pull
-- delta e o aparelho novo, que é quando não há cópia local.
--
-- security_invoker: sem isto a view rodaria com os direitos do dono e
-- atravessaria a RLS das tabelas base.

create or replace view vw_ultimo_desempenho with (security_invoker = on) as
select distinct on (se.exercicio_id, s.indice)
  ses.user_id,
  se.exercicio_id,
  s.indice,
  s.peso_kg,
  s.reps,
  s.rpe,
  s.duracao_seg,
  s.distancia_m,
  s.volume_kg,
  s.e1rm,
  ses.id        as sessao_id,
  ses.inicio_em,
  ses.data_local,
  s.atualizado_em
from series s
join sessao_exercicios se on se.id = s.sessao_exercicio_id
join sessoes ses          on ses.id = se.sessao_id
where ses.status = 'concluida'
  and s.concluida
  and s.tipo <> 'aquecimento'
  and s.excluido_em is null
  and se.excluido_em is null
order by se.exercicio_id, s.indice, ses.inicio_em desc, s.criado_em desc;

comment on view vw_ultimo_desempenho is
  'Última série concluída por (exercicio_id, indice), ignorando aquecimento.
   Não olha rotina de propósito — D-005, marcada pra revisitar em 3 semanas.';
