/**
 * Restaura um backup gerado por scripts/export.ts. D-016.
 *
 *   npx tsx scripts/restore.ts                      → o backup mais recente
 *   npx tsx scripts/restore.ts backups/2026-09-10   → um específico
 *   npx tsx scripts/restore.ts --wipe               → apaga tudo antes (round-trip)
 *
 * Lê a ordem de reimportação e a lista de colunas geradas do manifesto.json —
 * não repete essa informação aqui, pra não divergir do export.
 *
 * Coluna gerada é retirada antes do insert: o Postgres recusa (D-003), e o
 * valor volta idêntico porque a fórmula é aritmética pura da própria linha.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local", quiet: true });

interface Manifesto {
  gerado_em: string;
  ordem_reimportacao: string[];
  colunas_geradas: Record<string, string[]>;
  contagem: Record<string, number>;
}

const LOTE = 500;

function backupMaisRecente(): string {
  if (!existsSync("backups")) throw new Error("não existe pasta backups/ — rode o export antes");
  const dirs = readdirSync("backups").sort();
  if (!dirs.length) throw new Error("backups/ está vazia");
  return join("backups", dirs[dirs.length - 1]);
}

async function main() {
  const wipe = process.argv.includes("--wipe");
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const dir = arg ?? backupMaisRecente();

  const manifesto: Manifesto = JSON.parse(readFileSync(join(dir, "manifesto.json"), "utf8"));
  console.log(`restaurando de ${dir} (gerado em ${manifesto.gerado_em})\n`);

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false } },
  );

  if (wipe) {
    // Filho antes de pai: sessao_exercicios referencia exercicios com
    // `on delete restrict`, então a ordem inversa não é opcional.
    for (const tabela of [...manifesto.ordem_reimportacao].reverse()) {
      const { error } = await db.from(tabela).delete().not("id", "is", null);
      if (error) throw new Error(`wipe ${tabela}: ${error.message}`);
      console.log(`  apagado ${tabela}`);
    }
    console.log("");
  }

  for (const tabela of manifesto.ordem_reimportacao) {
    const bruto = readFileSync(join(dir, `${tabela}.jsonl`), "utf8").trim();
    const linhas: Record<string, unknown>[] = bruto ? bruto.split("\n").map((l) => JSON.parse(l)) : [];
    const geradas = manifesto.colunas_geradas[tabela] ?? [];

    const paraInserir = linhas.map((l) => {
      const copia = { ...l };
      for (const c of geradas) delete copia[c];
      return copia;
    });

    for (let i = 0; i < paraInserir.length; i += LOTE) {
      const { error } = await db.from(tabela).upsert(paraInserir.slice(i, i + LOTE), { onConflict: "id" });
      if (error) throw new Error(`${tabela} (lote ${i}): ${error.message}`);
    }

    const esperado = manifesto.contagem[tabela];
    const ok = paraInserir.length === esperado;
    console.log(
      `${ok ? "✓" : "✗"} ${tabela.padEnd(18)} ${String(paraInserir.length).padStart(6)} linhas` +
        (ok ? "" : `  (manifesto dizia ${esperado})`),
    );
  }

  console.log("\nrestaurado. Confira com: npx tsx scripts/export.ts --out <dir2> e compare.");
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
