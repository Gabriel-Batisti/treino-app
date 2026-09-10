/**
 * Export completo do banco pra arquivo. D-016.
 *
 *   npx tsx scripts/export.ts              → backups/AAAA-MM-DD/
 *   npx tsx scripts/export.ts --out <dir>  → outro destino (ex.: OneDrive)
 *
 * Dois formatos, de propósito:
 *   .jsonl  fiel e reimportável — uma linha JSON por registro, ordem estável
 *   .csv    legível em planilha, pra você conferir sem ferramenta nenhuma
 *
 * O JSONL guarda TUDO, inclusive coluna gerada (volume_kg, e1rm, duracao_seg).
 * É de propósito: o arquivo é uma fotografia do banco, não um payload de
 * insert. Quem reimporta é que tira as geradas — a lista está em COLUNAS_GERADAS
 * e o importador usa ela.
 *
 * Um export que nunca foi restaurado não é backup (D-016): depois de gerar,
 * rode o teste de restore.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local", quiet: true });

/** Ordem importa: pai antes de filho, pra reimportar sem violar FK. */
const TABELAS = [
  "exercicios",
  "rotinas",
  "rotina_exercicios",
  "sessoes",
  "sessao_exercicios",
  "series",
] as const;

/** Nunca entram em insert/update — o Postgres recusa (D-003). */
const COLUNAS_GERADAS: Record<string, string[]> = {
  sessoes: ["duracao_seg"],
  series: ["volume_kg", "e1rm"],
};

const PAGINA = 1000;

function hoje(): string {
  // Fuso explícito: o "dia" do backup é o dia daqui, não o UTC do runtime.
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function paraCsv(linhas: Record<string, unknown>[]): string {
  if (linhas.length === 0) return "";
  const colunas = Object.keys(linhas[0]);
  const escapa = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    colunas.join(","),
    ...linhas.map((l) => colunas.map((c) => escapa(l[c])).join(",")),
  ].join("\n");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !service) {
    console.error("✗ .env.local incompleto — rode: npx tsx scripts/check-env.ts");
    process.exit(1);
  }

  const argOut = process.argv.indexOf("--out");
  const destino = argOut > -1 ? process.argv[argOut + 1] : join("backups", hoje());
  mkdirSync(destino, { recursive: true });

  const db = createClient(url, service, { auth: { persistSession: false } });
  const manifesto: Record<string, number> = {};
  let total = 0;

  for (const tabela of TABELAS) {
    const linhas: Record<string, unknown>[] = [];
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await db
        .from(tabela)
        .select("*")
        // Ordem estável: sem isto, dois exports do mesmo dado dão diffs falsos.
        .order("criado_em", { ascending: true })
        .order("id", { ascending: true })
        .range(de, de + PAGINA - 1);
      if (error) {
        console.error(`✗ ${tabela}: ${error.message}`);
        process.exit(1);
      }
      linhas.push(...(data ?? []));
      if (!data || data.length < PAGINA) break;
    }

    const jsonl = linhas.map((l) => JSON.stringify(l)).join("\n");
    writeFileSync(join(destino, `${tabela}.jsonl`), jsonl ? jsonl + "\n" : "", "utf8");
    writeFileSync(join(destino, `${tabela}.csv`), paraCsv(linhas), "utf8");

    manifesto[tabela] = linhas.length;
    total += linhas.length;
    console.log(`✓ ${tabela.padEnd(18)} ${String(linhas.length).padStart(6)} linhas`);
  }

  writeFileSync(
    join(destino, "manifesto.json"),
    JSON.stringify(
      {
        gerado_em: new Date().toISOString(),
        projeto: url,
        migration: "0001_treino",
        ordem_reimportacao: TABELAS,
        colunas_geradas: COLUNAS_GERADAS,
        contagem: manifesto,
        total,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(`\n${total} linhas em ${destino}`);
  if (total === 0) {
    console.log("(banco vazio — o formato está provado, o conteúdo virá com a importação do Heavy)");
  }
}

main().catch((e) => {
  console.error("✗ erro inesperado:", e instanceof Error ? e.message : e);
  process.exit(1);
});
