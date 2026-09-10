/**
 * Insere um treino de mentira pra testar o round-trip do backup (D-016) e
 * conferir as colunas geradas contra o banco de verdade.
 *
 *   npx tsx scripts/fixture-teste.ts
 *
 * TRAVA: aborta se houver qualquer linha que não seja fixture. Este script
 * escreve com service role (atravessa RLS) — nunca deve encostar em dado real.
 *
 * Limpa com: npx tsx scripts/fixture-teste.ts --limpar
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

config({ path: ".env.local", quiet: true });

const MARCA = "(FIXTURE)";

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false } },
  );

  // ── trava ────────────────────────────────────────────────────────────────
  const { data: existentes } = await db.from("exercicios").select("id,nome");
  const reais = (existentes ?? []).filter((e) => !e.nome.includes(MARCA));
  if (reais.length > 0) {
    console.error(`✗ ABORTADO: já existem ${reais.length} exercícios que não são fixture.`);
    console.error("  Este script só roda em banco vazio ou só com fixture.");
    process.exit(1);
  }

  if (process.argv.includes("--limpar")) {
    // Ordem obrigatória: sessao_exercicios referencia exercicios com
    // `on delete restrict`, então apagar exercicios primeiro estoura a FK.
    // Apagar a sessão cascateia pra sessao_exercicios e series.
    const { error: es } = await db.from("sessoes").delete().like("nome", `%${MARCA}%`);
    if (es) throw new Error(`limpar sessoes: ${es.message}`);
    for (const e of existentes ?? []) {
      const { error } = await db.from("exercicios").delete().eq("id", e.id);
      if (error) throw new Error(`limpar exercicios: ${error.message}`);
    }
    console.log("✓ fixture removida");
    return;
  }

  const { data: users, error: eu } = await db.auth.admin.listUsers();
  if (eu) throw new Error(`listUsers: ${eu.message}`);
  if (!users.users.length) throw new Error("nenhum usuário em auth.users — crie no dashboard");
  const uid = users.users[0].id;
  console.log(`usuário: ${users.users[0].email}\n`);

  const exercicioId = randomUUID();
  const sessaoId = randomUUID();
  const seId = randomUUID();
  const inicio = new Date(Date.now() - 3600_000);
  const fim = new Date();

  const chk = (r: { error: unknown }, onde: string) => {
    const err = r.error as { message: string } | null;
    if (err) throw new Error(`${onde}: ${err.message}`);
  };

  chk(await db.from("exercicios").insert({
    id: exercicioId, user_id: uid,
    nome: `Supino Reto ${MARCA}`, nome_busca: `supino reto ${MARCA.toLowerCase()}`,
    grupo_muscular: "peito", equipamento: "barra", fonte: "manual",
  }), "exercicios");

  chk(await db.from("sessoes").insert({
    id: sessaoId, user_id: uid, nome: `Treino ${MARCA}`,
    inicio_em: inicio.toISOString(), fim_em: fim.toISOString(),
    data_local: "2026-09-10", status: "concluida", origem: "app",
  }), "sessoes");

  chk(await db.from("sessao_exercicios").insert({
    id: seId, sessao_id: sessaoId, exercicio_id: exercicioId, ordem: 0,
    nome_snapshot: `Supino Reto ${MARCA}`, modo_medicao_snapshot: "peso_reps",
  }), "sessao_exercicios");

  // Séries escolhidas pra provar o D-004: 100×1 tem que dar e1rm 100,00
  // (Epley daria 103,33) e 60×15 tem que dar null (acima de 12 reps).
  chk(await db.from("series").insert([
    { id: randomUUID(), sessao_exercicio_id: seId, indice: 1, tipo: "aquecimento", peso_kg: 40, reps: 10, concluida: true, registrada_em: inicio.toISOString() },
    { id: randomUUID(), sessao_exercicio_id: seId, indice: 2, tipo: "normal", peso_kg: 100, reps: 1, concluida: true, registrada_em: inicio.toISOString() },
    { id: randomUUID(), sessao_exercicio_id: seId, indice: 3, tipo: "normal", peso_kg: 80, reps: 8, concluida: true, registrada_em: inicio.toISOString() },
    { id: randomUUID(), sessao_exercicio_id: seId, indice: 4, tipo: "normal", peso_kg: 60, reps: 15, concluida: true, registrada_em: inicio.toISOString() },
  ]), "series");

  const { data: s } = await db.from("series")
    .select("indice,tipo,peso_kg,reps,volume_kg,e1rm")
    .eq("sessao_exercicio_id", seId).order("indice");
  console.log("COLUNAS GERADAS (series):");
  console.table(s);

  const { data: ses } = await db.from("sessoes").select("duracao_seg").eq("id", sessaoId).single();
  console.log(`duracao_seg = ${ses?.duracao_seg}   (esperado 3600)\n`);

  const { data: v } = await db.from("vw_ultimo_desempenho")
    .select("indice,peso_kg,reps,e1rm").eq("exercicio_id", exercicioId).order("indice");
  console.log("vw_ultimo_desempenho — aquecimento (índice 1) tem que estar FORA:");
  console.table(v);
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
