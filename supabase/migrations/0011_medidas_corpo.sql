-- 0011_medidas_corpo.sql
-- Medidas de fita: cintura, braço, coxa e companhia.
--
-- RODAR MANUALMENTE no SQL editor do Supabase. Depois:
--   npx supabase gen types typescript --project-id <ref> > types/database.ts
--
-- POR QUE TABELA NOVA e não mais colunas em `medidas`: são coisas diferentes.
-- `medidas` é pesagem — acontece todo dia e tem bioimpedância junto. Fita é
-- eventual, feita por outra pessoa, e nenhuma das duas quer as colunas da
-- outra vazias na maior parte das linhas.
--
-- POR QUE jsonb E NÃO QUATORZE COLUNAS: a lista de pontos que se mede muda
-- mais que o esquema — hoje é cintura e braço, amanhã entra pescoço. Em
-- `lib/medidas/sites.ts` isso é uma linha; em coluna, é migration e deploy.
-- Os valores são poucos e lidos todos juntos, então não se perde consulta.

create table if not exists medidas_corpo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,

  -- Do relógio do celular, não de now() no servidor (D-012).
  data_local date not null,

  -- { "cintura": 88.5, "braco_d": 36, ... } em centímetros. Chaves vêm de
  -- lib/medidas/sites.ts.
  valores jsonb not null default '{}'::jsonb,
  notas text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Exclusão é soft, como em toda tabela sincronizada (D-007).
  excluido_em timestamptz
);

-- Uma medição por dia: remedir no mesmo dia CORRIGE em vez de duplicar.
create unique index if not exists medidas_corpo_dia_uidx
  on medidas_corpo (user_id, data_local) where excluido_em is null;

alter table medidas_corpo enable row level security;

drop policy if exists "medidas_corpo do dono" on medidas_corpo;
create policy "medidas_corpo do dono" on medidas_corpo
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table medidas_corpo is
  'Medidas de fita métrica, em cm. Um registro por dia; chaves em sites.ts.';
