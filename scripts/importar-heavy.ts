/**
 * Importa o histórico exportado do Heavy (CSV, uma linha por série). D-014.
 *
 *   npx tsx scripts/importar-heavy.ts --dry-run          (não escreve nada)
 *   npx tsx scripts/importar-heavy.ts
 *   npx tsx scripts/importar-heavy.ts data/outro.csv
 *
 * IDEMPOTENTE: todo id é derivado do conteúdo (uuid v5 sobre a chave natural),
 * então reimportar o mesmo arquivo faz upsert em cima de si mesmo, sem
 * duplicar. Editar scripts/heavy/aliases.ts e rodar de novo é seguro.
 *
 * Peculiaridades do arquivo, medidas e não supostas:
 *   - quebras de linha MISTURADAS (LF no começo, CRLF no fim) — daí o
 *     record_delimiter com os dois
 *   - datas em pt-BR sem fuso ("10 set 2026, 07:43") → America/Sao_Paulo.
 *     O Brasil não tem horário de verão desde 2019, então -03:00 é constante
 *     no período do arquivo (2025-2026); não vale generalizar pra antes disso.
 *   - set_index começa em 0; nosso `indice` começa em 1
 *   - rpe, duration_seconds e superset_id vêm 100% vazios neste export
 *   - set_type é 'normal' em todas as linhas: não há aquecimento marcado
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { normalizarNome } from "../lib/treino/texto";
import { canonico, ALIASES } from "./heavy/aliases";

config({ path: ".env.local", quiet: true });

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const TIPO_SERIE: Record<string, string> = {
  normal: "normal",
  warmup: "aquecimento",
  failure: "falha",
  dropset: "drop",
  drop_set: "drop",
};

/** uuid v5 (namespace fixo) — id determinístico a partir da chave natural. */
const NS = "treino-app/heavy/v1";
function idDe(chave: string): string {
  const h = createHash("sha1").update(`${NS}|${chave}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50; // versão 5
  h[8] = (h[8] & 0x3f) | 0x80; // variante RFC 4122
  const s = h.subarray(0, 16).toString("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

interface DataLocal { iso: string; dia: string }

function parseData(s: string): DataLocal {
  const m = s.trim().match(/^(\d{1,2}) (\w{3})\w* (\d{4}), (\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`data não reconhecida: "${s}"`);
  const mes = MESES[m[2].toLowerCase()];
  if (!mes) throw new Error(`mês não reconhecido: "${m[2]}" em "${s}"`);
  const p = (n: string | number, w = 2) => String(n).padStart(w, "0");
  const dia = `${m[3]}-${p(mes)}-${p(m[1])}`;
  return { iso: `${dia}T${p(m[4])}:${m[5]}:00-03:00`, dia };
}

/** Equipamento a partir do sufixo do nome. Best-effort; o usuário edita depois. */
function equipamentoDe(nome: string): string | null {
  const n = normalizarNome(nome);
  if (/\(maquina smith\)|\(smith\)|smith machine/.test(n)) return "smith";
  if (/\(maquina\)|\(machine\)|maquina/.test(n)) return "maquina";
  if (/\(cabo\)|\(cable\)|polia|pushdown|crossover/.test(n)) return "cabo";
  if (/\(halter\)|\(dumbbell\)|dumbbell/.test(n)) return "halter";
  if (/\(barra\)|\(barbell\)|barbell|barra/.test(n)) return "barra";
  return null;
}

const num = (v: string | undefined): number | null => {
  const s = v?.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const arquivo = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "data/workout_data.csv";

  type L = Record<string, string>;
  const rows: L[] = parse(readFileSync(arquivo, "utf8"), {
    columns: true, skip_empty_lines: true, bom: true,
    record_delimiter: ["\r\n", "\n"],
  });
  console.log(`${arquivo}: ${rows.length} séries\n`);

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false } },
  );
  const { data: users, error: eu } = await db.auth.admin.listUsers();
  if (eu) throw new Error(`listUsers: ${eu.message}`);
  if (!users.users.length) throw new Error("nenhum usuário em auth.users");
  const uid = users.users[0].id;

  // ── 1. exercícios ────────────────────────────────────────────────────────
  interface Ex { nome: string; nome_busca: string; usos: number; ultimo: string; comCarga: number; origens: Set<string> }
  const exercicios = new Map<string, Ex>();
  for (const r of rows) {
    const nome = canonico(r.exercise_title);
    const busca = normalizarNome(nome);
    const { iso } = parseData(r.start_time);
    const e = exercicios.get(busca) ?? { nome, nome_busca: busca, usos: 0, ultimo: iso, comCarga: 0, origens: new Set() };
    e.usos++;
    if (iso > e.ultimo) e.ultimo = iso;
    if ((num(r.weight_kg) ?? 0) > 0) e.comCarga++;
    e.origens.add(r.exercise_title);
    exercicios.set(busca, e);
  }

  const linhasExercicios = [...exercicios.values()].map((e) => ({
    id: idDe(`exercicio|${e.nome_busca}`),
    user_id: uid,
    nome: e.nome,
    nome_busca: e.nome_busca,
    equipamento: equipamentoDe(e.nome),
    // Sem carga em nenhuma série = exercício de peso corporal.
    modo_medicao: e.comCarga === 0 ? "peso_corporal_reps" : "peso_reps",
    fonte: "importado_heavy",
    usos: e.usos,
    ultimo_uso_em: e.ultimo,
  }));

  // ── 2. sessões e séries ──────────────────────────────────────────────────
  const sessoes = new Map<string, Record<string, unknown>>();
  const sessaoExercicios = new Map<string, Record<string, unknown>>();
  const series: Record<string, unknown>[] = [];
  let semTipo = 0;

  for (const r of rows) {
    const ini = parseData(r.start_time);
    const fim = r.end_time?.trim() ? parseData(r.end_time) : null;
    const sessaoId = idDe(`sessao|${r.start_time}`);

    if (!sessoes.has(sessaoId)) {
      sessoes.set(sessaoId, {
        id: sessaoId, user_id: uid, rotina_id: null,
        nome: r.title || null,
        inicio_em: ini.iso, fim_em: fim?.iso ?? null, data_local: ini.dia,
        status: "concluida", origem: "importado_heavy",
        notas: r.description?.trim() || null,
      });
    }

    const nome = canonico(r.exercise_title);
    const busca = normalizarNome(nome);
    const seId = idDe(`sessao_ex|${r.start_time}|${busca}`);
    if (!sessaoExercicios.has(seId)) {
      sessaoExercicios.set(seId, {
        id: seId, sessao_id: sessaoId,
        exercicio_id: idDe(`exercicio|${busca}`),
        ordem: sessaoExercicios.size,
        nome_snapshot: nome,
        modo_medicao_snapshot: (num(r.weight_kg) ?? 0) > 0 ? "peso_reps" : "peso_corporal_reps",
        superset_grupo: r.superset_id?.trim() || null,
        notas: r.exercise_notes?.trim() || null,
      });
    } else if (r.exercise_notes?.trim()) {
      // A nota do exercício se repete em toda linha; basta a primeira não-vazia.
      const atual = sessaoExercicios.get(seId)!;
      if (!atual.notas) atual.notas = r.exercise_notes.trim();
    }

    const tipo = TIPO_SERIE[r.set_type?.trim().toLowerCase()];
    if (!tipo) semTipo++;

    series.push({
      id: idDe(`serie|${r.start_time}|${busca}|${r.set_index}`),
      sessao_exercicio_id: seId,
      indice: Number(r.set_index) + 1, // o export é 0-based, nosso índice é 1-based
      tipo: tipo ?? "normal",
      peso_kg: num(r.weight_kg),
      reps: num(r.reps),
      rpe: num(r.rpe),
      duracao_seg: num(r.duration_seconds),
      distancia_m: num(r.distance_km) != null ? num(r.distance_km)! * 1000 : null,
      concluida: true,
      // O export não traz horário por série: cai pro início da sessão.
      registrada_em: ini.iso,
    });
  }

  // ── 3. relatório ─────────────────────────────────────────────────────────
  const juntados = Object.keys(ALIASES).filter((k) => rows.some((r) => r.exercise_title === k));
  console.log(`exercícios ..... ${linhasExercicios.length}  (de ${new Set(rows.map((r) => r.exercise_title)).size} nomes no arquivo, ${juntados.length} juntados)`);
  console.log(`sessões ........ ${sessoes.size}`);
  console.log(`séries ......... ${series.length}`);
  const pc = linhasExercicios.filter((e) => e.modo_medicao === "peso_corporal_reps");
  console.log(`peso corporal .. ${pc.length}${pc.length ? `  (${pc.map((e) => e.nome).join(", ")})` : ""}`);
  const comNota = [...sessaoExercicios.values()].filter((s) => s.notas);
  console.log(`com anotação ... ${comNota.length}`);
  if (semTipo) console.log(`⚠ set_type desconhecido em ${semTipo} linhas — tratadas como 'normal'`);

  const top = [...exercicios.values()].sort((a, b) => b.usos - a.usos).slice(0, 8);
  console.log("\ntop 8 por frequência (é isto que vai ordenar a busca no dia 1):");
  for (const e of top) {
    const fontes = e.origens.size > 1 ? `  ← ${[...e.origens].join(" + ")}` : "";
    console.log(`  ${String(e.usos).padStart(4)}x  ${e.nome}${fontes}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: nada foi escrito.");
    return;
  }

  // ── 4. escrita, pai antes de filho ───────────────────────────────────────
  const lote = async (tabela: string, linhas: Record<string, unknown>[]) => {
    for (let i = 0; i < linhas.length; i += 500) {
      const { error } = await db.from(tabela).upsert(linhas.slice(i, i + 500), { onConflict: "id" });
      if (error) throw new Error(`${tabela} (lote ${i}): ${error.message}`);
    }
    console.log(`✓ ${tabela.padEnd(18)} ${linhas.length}`);
  };

  console.log("");
  await lote("exercicios", linhasExercicios);
  await lote("sessoes", [...sessoes.values()]);
  await lote("sessao_exercicios", [...sessaoExercicios.values()]);
  await lote("series", series);
  console.log("\nimportado.");
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
