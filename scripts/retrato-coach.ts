/**
 * Gera o retrato de treino que o coach lê — `coach/retrato.md`.
 *
 *   npx tsx scripts/retrato-coach.ts
 *
 * O coach NÃO conversa com o banco. Ele lê este arquivo. A consequência de
 * desenho é que o retrato precisa caber no contexto de uma conversa: umas duas
 * páginas, não um dump. Por isso aqui tem agregado e recorte, não tabela crua —
 * "quantas vezes você treinou peito nas últimas 8 semanas" vale mais que 1.259
 * linhas de série.
 *
 * O QUE ENTRA foi escolhido pelas perguntas que ele precisa responder:
 *   - "troco este exercício por qual?"      → catálogo com músculo e aparelho
 *   - "quero focar em ombro, como encaixo?" → rotinas e frequência por grupo
 *   - "estou estagnado?"                    → recorde e quando ele foi batido
 *
 * Roda com service role e NÃO escreve nada — só lê.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { ilustracaoDe } from "../lib/treino/ilustracoes";
import { equipamentoDoNome } from "../lib/treino/substituir";

config({ path: ".env.local", quiet: true });

const SAIDA = "coach/retrato.md";
/** Janela dos agregados. 8 semanas cobre um ciclo e ignora o que já passou. */
const SEMANAS = 8;

/** Nomes da free-exercise-db são em inglês; o coach responde em português. */
const MUSCULO_PT: Record<string, string> = {
  chest: "peito",
  lats: "dorsal",
  "middle back": "costas (meio)",
  "lower back": "lombar",
  traps: "trapézio",
  shoulders: "ombro",
  biceps: "bíceps",
  triceps: "tríceps",
  forearms: "antebraço",
  quadriceps: "quadríceps",
  hamstrings: "posterior",
  glutes: "glúteo",
  calves: "panturrilha",
  abdominals: "abdômen",
  adductors: "adutor",
  abductors: "abdutor",
};

const pt = (m: string) => MUSCULO_PT[m] ?? m;
const data = (d: string) => new Date(`${d}T12:00:00-03:00`).toLocaleDateString("pt-BR");

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false } },
  );

  const corte = new Date(Date.now() - SEMANAS * 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [{ data: exercicios }, { data: rotinas }, { data: sessoes }, { data: recordes }] =
    await Promise.all([
      db.from("exercicios").select("id, nome, nome_busca, usos, ultimo_uso_em").eq("arquivado", false),
      db
        .from("rotinas")
        .select("nome, ordem, arquivada, rotina_exercicios(ordem, series_alvo, excluido_em, exercicios(id, nome))")
        .eq("arquivada", false)
        .order("ordem"),
      db
        .from("sessoes")
        .select("id, nome, data_local, duracao_seg, sessao_exercicios(exercicio_id, nome_snapshot, series(peso_kg, reps, concluida, volume_kg))")
        .eq("status", "concluida")
        .gte("data_local", corte)
        .order("data_local", { ascending: false }),
      // A view de recorde só guarda o VALOR, não quando ele foi batido — e
      // "há quanto tempo" é metade do sinal de estagnação. Então vem do
      // histórico cru. São ~1.300 séries: pesado pro app, trivial pro script.
      db
        .from("series")
        .select("peso_kg, reps, concluida, tipo, excluido_em, sessao_exercicios!inner(exercicio_id, excluido_em, sessoes!inner(data_local, status))")
        .eq("concluida", true)
        .neq("tipo", "aquecimento")
        .is("excluido_em", null)
        .range(0, 9999),
    ]);

  const porId = new Map((exercicios ?? []).map((e) => [e.id, e]));
  const musculoDe = (nomeBusca: string) => ilustracaoDe(nomeBusca)?.musculos.map(pt) ?? [];

  const linhas: string[] = [];
  const P = (s = "") => linhas.push(s);

  P("# Retrato de treino");
  P();
  P(`Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`);
  P(`Agregados cobrem as últimas ${SEMANAS} semanas (desde ${data(corte)}).`);
  P();
  P("Este arquivo é gerado do banco do app. Não editar à mão.");
  P();

  // ── rotinas ───────────────────────────────────────────────────────────────
  P("## Rotinas ativas");
  P();
  for (const r of rotinas ?? []) {
    const itens = ((r.rotina_exercicios ?? []) as unknown as {
      ordem: number;
      series_alvo: number | null;
      excluido_em: string | null;
      exercicios: { id: string; nome: string } | null;
    }[])
      .filter((i) => !i.excluido_em && i.exercicios)
      .sort((a, b) => a.ordem - b.ordem);

    const musculos = new Set<string>();
    for (const i of itens) {
      const ex = porId.get(i.exercicios!.id);
      if (ex) musculoDe(ex.nome_busca).forEach((m) => musculos.add(m));
    }

    P(`### ${r.nome}`);
    P(`Trabalha: ${[...musculos].join(", ") || "—"}`);
    for (const i of itens) {
      P(`- ${i.exercicios!.nome} — ${i.series_alvo ?? "?"} séries`);
    }
    P();
  }

  // ── frequência por músculo ────────────────────────────────────────────────
  const seriesPorMusculo = new Map<string, number>();
  const diasPorMusculo = new Map<string, Set<string>>();
  let seriesTotal = 0;

  for (const s of sessoes ?? []) {
    for (const se of (s.sessao_exercicios ?? []) as unknown as {
      exercicio_id: string;
      series: { concluida: boolean }[];
    }[]) {
      const feitas = (se.series ?? []).filter((x) => x.concluida).length;
      if (!feitas) continue;
      seriesTotal += feitas;
      const ex = porId.get(se.exercicio_id);
      if (!ex) continue;
      for (const m of musculoDe(ex.nome_busca)) {
        seriesPorMusculo.set(m, (seriesPorMusculo.get(m) ?? 0) + feitas);
        if (!diasPorMusculo.has(m)) diasPorMusculo.set(m, new Set());
        diasPorMusculo.get(m)!.add(s.data_local);
      }
    }
  }

  P(`## Volume por músculo — últimas ${SEMANAS} semanas`);
  P();
  P(`${sessoes?.length ?? 0} treinos, ${seriesTotal} séries.`);
  P();
  P("| músculo | séries | séries/semana | dias |");
  P("|---|---|---|---|");
  for (const [m, n] of [...seriesPorMusculo.entries()].sort((a, b) => b[1] - a[1])) {
    P(`| ${m} | ${n} | ${(n / SEMANAS).toFixed(1)} | ${diasPorMusculo.get(m)?.size ?? 0} |`);
  }
  P();

  // ── recordes e estagnação ─────────────────────────────────────────────────
  P("## Carga por exercício");
  P();
  P("`recorde` é a maior carga já registrada. `desde` é há quantos dias ela foi batida —");
  P("número alto com uso recente é sinal de estagnação.");
  P();
  P("| exercício | músculo | aparelho | recorde | desde | usos |");
  P("|---|---|---|---|---|---|");

  // Recorde = maior carga já levantada, e a data em que foi levantada pela
  // ÚLTIMA vez. Repetir o recorde hoje zera o contador de estagnação, que é o
  // comportamento certo: quem igualou não está parado, está no teto.
  const recPorId = new Map<
    string,
    { melhor_peso: number; melhor_reps: number | null; quando: string }
  >();

  for (const linha of (recordes ?? []) as unknown as {
    peso_kg: number | null;
    reps: number | null;
    sessao_exercicios: {
      exercicio_id: string;
      excluido_em: string | null;
      sessoes: { data_local: string; status: string };
    };
  }[]) {
    const se = linha.sessao_exercicios;
    if (!se || se.excluido_em || se.sessoes?.status !== "concluida") continue;
    const peso = Number(linha.peso_kg ?? 0);
    if (!peso) continue;

    const atual = recPorId.get(se.exercicio_id);
    if (!atual || peso > atual.melhor_peso) {
      recPorId.set(se.exercicio_id, {
        melhor_peso: peso,
        melhor_reps: linha.reps,
        quando: se.sessoes.data_local,
      });
    } else if (peso === atual.melhor_peso && se.sessoes.data_local > atual.quando) {
      atual.quando = se.sessoes.data_local;
      atual.melhor_reps = Math.max(atual.melhor_reps ?? 0, linha.reps ?? 0) || atual.melhor_reps;
    }
  }

  const usados = (exercicios ?? [])
    .filter((e) => (e.usos ?? 0) > 0)
    .sort((a, b) => (b.usos ?? 0) - (a.usos ?? 0));

  for (const e of usados) {
    const r = recPorId.get(e.id);
    const dias = r?.quando
      ? Math.round((Date.now() - new Date(`${r.quando}T12:00:00-03:00`).getTime()) / 86_400_000)
      : null;
    const equip = equipamentoDoNome(e.nome) ?? ilustracaoDe(e.nome_busca)?.equipamento ?? "—";
    P(
      `| ${e.nome} | ${musculoDe(e.nome_busca).join(", ") || "—"} | ${equip} | ` +
        `${r?.melhor_peso ?? "—"} kg × ${r?.melhor_reps ?? "—"} | ${dias != null ? `${dias}d` : "—"} | ${e.usos} |`,
    );
  }
  P();

  // ── últimos treinos ───────────────────────────────────────────────────────
  P("## Últimos treinos");
  P();
  for (const s of (sessoes ?? []).slice(0, 12)) {
    const exs = (s.sessao_exercicios ?? []) as unknown as {
      nome_snapshot: string;
      series: { concluida: boolean; volume_kg: number | null }[];
    }[];
    const series = exs.flatMap((e) => e.series ?? []).filter((x) => x.concluida);
    const vol = Math.round(series.reduce((n, x) => n + Number(x.volume_kg ?? 0), 0));
    P(
      `- **${data(s.data_local)}** · ${s.nome ?? "Treino"} · ` +
        `${Math.round((s.duracao_seg ?? 0) / 60)} min · ${series.length} séries · ${vol} kg`,
    );
  }
  P();

  mkdirSync("coach", { recursive: true });
  writeFileSync(SAIDA, linhas.join("\n"), "utf-8");
  console.log(`${SAIDA} — ${linhas.length} linhas, ${(linhas.join("\n").length / 1024).toFixed(1)} KB`);
}

main();
