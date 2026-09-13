-- 0010_medidas_dados.sql
-- O laudo inteiro da bioimpedância, do jeito que o parser leu.
--
-- RODAR MANUALMENTE no SQL editor do Supabase. Depois:
--   npx supabase gen types typescript --project-id <ref> > types/database.ts
--
-- POR QUE jsonb E NÃO TRINTA COLUNAS: o InBody imprime ~30 números, e a tela
-- de detalhe quer todos. Trinta colunas seriam trinta migrations quando a
-- clínica trocar de aparelho — e os campos extras não entram em consulta,
-- filtro nem gráfico comparativo: são lidos junto com a linha e exibidos.
--
-- Os SETE que alimentam gráfico e histórico continuam colunas de verdade
-- (peso_kg, gordura_pct, massa_magra_kg, massa_muscular_kg, agua_pct,
-- gordura_visceral, tmb_kcal). Isto aqui é o que sobra.
--
-- FORMA do conteúdo: o tipo LeituraInbody de lib/medidas/inbody.ts. Inclui as
-- FAIXAS DE REFERÊNCIA impressas no laudo — que são calculadas pra altura e
-- sexo da pessoa, não uma tabela genérica — e a análise segmentar.

alter table medidas add column if not exists dados jsonb;

comment on column medidas.dados is
  'Laudo completo lido do PDF (LeituraInbody). Os sete campos principais
   continuam em colunas próprias; aqui fica o resto, inclusive faixas de
   referência do laudo e análise segmentar.';
