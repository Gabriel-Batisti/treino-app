-- 0002_cardio.sql
-- Registro de cardio, separado da musculação.
--
-- RODAR MANUALMENTE no SQL editor do Supabase. Depois:
--   npx supabase gen types typescript --project-id <ref> > types/database.ts
--
-- POR QUE TABELA PRÓPRIA, e não `series` com modo_medicao='tempo':
-- cardio não tem série, nem índice, nem peso, e tem caloria — que não existe
-- em lugar nenhum do modelo de musculação. Enfiar na `series` obrigaria a
-- deixar metade das colunas nulas e ainda assim faltaria uma. Tabela separada
-- custa menos que o remendo.
--
-- Segue as mesmas regras (ver DECISIONS.md):
--   D-007  id do client, `atualizado_em` pro sync delta, exclusão por
--          `excluido_em` (nunca hard delete)
--   D-012  `data_local` gravada pelo client, separada do timestamptz

create table if not exists cardios (
  -- SEM default: o id vem do client, pra o upsert ser idempotente (D-007).
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,

  tipo text not null check (tipo in (
    'esteira','bicicleta','eliptico','escada','remo','corrida','caminhada','outro'
  )),

  inicio_em timestamptz not null,
  -- Do relógio do celular. Sem isto, o cardio das 22h cai no dia seguinte em
  -- UTC — o servidor da Vercel roda em UTC (D-012).
  data_local date not null,

  duracao_min integer not null check (duracao_min > 0 and duracao_min <= 600),
  calorias integer check (calorias >= 0 and calorias <= 5000),
  distancia_km numeric check (distancia_km >= 0),
  intensidade text check (intensidade in ('leve','moderado','intenso')),
  notas text,

  -- Aritmética imutável da própria linha (D-003). Serve pra comparar sessões
  -- de durações diferentes sem recalcular a cada query.
  kcal_por_min numeric generated always as (
    case when calorias is not null and duracao_min > 0
         then round(calorias::numeric / duracao_min, 2) end
  ) stored,

  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table cardios is
  'Sessão de cardio avulsa: tipo, duração e calorias. Separada de `sessoes`
   porque não tem série nem carga, e tem caloria — que a musculação não tem.';

alter table cardios enable row level security;

-- drop antes de criar: esta migration é re-executável de ponta a ponta.
drop policy if exists "own_cardios" on cardios;
create policy "own_cardios" on cardios for all
  using (user_id = auth.uid());

create index if not exists cardios_data_idx
  on cardios (user_id, data_local desc) where excluido_em is null;
create index if not exists cardios_delta_idx
  on cardios (user_id, atualizado_em);

drop trigger if exists cardios_set_updated_at on cardios;
create trigger cardios_set_updated_at before update on cardios
  for each row execute function set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- vw_recorde_exercicio — o melhor de cada exercício, uma linha por exercício
-- ─────────────────────────────────────────────────────────────────────────────
-- Existe pra a timeline poder contar "recordes" da sessão sem baixar o
-- histórico inteiro no cliente a cada carregamento. São ~48 linhas.
--
-- `melhor_peso` é FATO; `melhor_e1rm` é estimativa (Brzycki, D-004). A UI
-- mostra o peso como recorde principal e o e1RM como secundário.
--
-- security_invoker: sem isto a view rodaria com os direitos do dono e
-- atravessaria a RLS das tabelas base.

create or replace view vw_recorde_exercicio with (security_invoker = on) as
select
  ses.user_id,
  se.exercicio_id,
  max(s.peso_kg)   as melhor_peso,
  max(s.e1rm)      as melhor_e1rm,
  max(s.volume_kg) as melhor_volume_serie,
  count(*)         as total_series
from series s
join sessao_exercicios se on se.id = s.sessao_exercicio_id
join sessoes ses          on ses.id = se.sessao_id
where ses.status = 'concluida'
  and s.concluida
  and s.tipo <> 'aquecimento'
  and s.excluido_em is null
  and se.excluido_em is null
group by ses.user_id, se.exercicio_id;

comment on view vw_recorde_exercicio is
  'Melhor marca por exercício. Evita baixar o histórico inteiro só pra contar
   recordes na timeline.';
