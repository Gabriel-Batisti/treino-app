/**
 * Cria `rotinas` a partir do histórico importado.
 *
 *   npx tsx scripts/gerar-rotinas.ts --dry-run
 *   npx tsx scripts/gerar-rotinas.ts
 *
 * POR QUE ISTO EXISTE: o export do Heavy traz histórico, não template. Sem
 * rotina, a home tinha que inferir o treino da ÚLTIMA SESSÃO — e abandonar um
 * treino no meio corrompia o modelo (o "Treino 3" virava 1 exercício). Rotina
 * de verdade conserta isso e é o que sustenta faixa de reps e descanso.
 *
 * O que é inferido, e de onde:
 *   exercícios e ordem  → a sessão mais recente daquele nome
 *   séries_alvo         → mediana de séries por sessão
 *   faixa de reps       → p20 e p80 das reps do exercício NAQUELE treino
 *                         (percentil, não min/max: uma série falha de 2 reps
 *                          não pode virar o piso da faixa)
 *   descanso            → 120s fixo; o histórico não registra descanso
 *
 * Idempotente: id determinístico por nome de rotina.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

config({ path: ".env.local", quiet: true });

const DESCANSO_PADRAO_SEG = 120;
const SESSOES_RECENTES = 120;
/**
 * Antes era 45 dias, o que descartava os Treinos A-E. Passou a 400 porque a
 * tela agora AGRUPA em vez de esconder: as de letra viram "Muscle lab", as de
 * número "Minhas rotinas". Ocultar é decisão do usuário (rotinas.arquivada),
 * não do script.
 */
const DIAS_PARA_ESQUECER = 400;
/** Faixa de reps nunca menor que isto: "9-9" não é alvo, é número. */
const BANDA_MINIMA = 4;
/** Abaixo disto o percentil vira min/max e uma série falha define o piso. */
const AMOSTRA_MINIMA = 8;

function idDe(chave: string): string {
  const h = createHash("sha1").update(`treino-app/rotina/v1|${chave}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const s = h.subarray(0, 16).toString("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

function percentil(valores: number[], p: number): number {
  if (!valores.length) return 0;
  const ord = [...valores].sort((a, b) => a - b);
  const i = Math.min(ord.length - 1, Math.max(0, Math.round((ord.length - 1) * p)));
  return ord[i];
}

function mediana(valores: number[]): number {
  if (!valores.length) return 0;
  const ord = [...valores].sort((a, b) => a - b);
  return ord[Math.floor(ord.length / 2)];
}

interface LinhaSerie { reps: number | null }
interface LinhaSessaoEx {
  exercicio_id: string;
  ordem: number;
  nome_snapshot: string;
  series: LinhaSerie[];
}
interface LinhaSessao {
  id: string;
  nome: string | null;
  inicio_em: string;
  sessao_exercicios: LinhaSessaoEx[];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false } },
  );

  const { data: users } = await db.auth.admin.listUsers();
  const uid = users.users[0]?.id;
  if (!uid) throw new Error("nenhum usuário em auth.users");

  const { data, error } = await db
    .from("sessoes")
    .select("id, nome, inicio_em, sessao_exercicios(exercicio_id, ordem, nome_snapshot, series(reps))")
    .eq("status", "concluida")
    .order("inicio_em", { ascending: false })
    .limit(SESSOES_RECENTES);
  if (error) throw new Error(error.message);
  const sessoes = (data ?? []) as unknown as LinhaSessao[];

  // Agrupa por nome de treino, do mais recente pro mais antigo.
  const porNome = new Map<string, LinhaSessao[]>();
  for (const s of sessoes) {
    const nome = s.nome?.trim();
    if (!nome) continue;
    porNome.set(nome, [...(porNome.get(nome) ?? []), s]);
  }

  const rotinas: Record<string, unknown>[] = [];
  const itens: Record<string, unknown>[] = [];
  let ordemRotina = 0;

  const hoje = Date.now();
  for (const [nome, lista] of porNome) {
    const diasDesdeUltima = (hoje - new Date(lista[0].inicio_em).getTime()) / 86_400_000;
    if (diasDesdeUltima > DIAS_PARA_ESQUECER) {
      console.log(`
${nome} — pulado (última vez há ${Math.round(diasDesdeUltima)} dias)`);
      continue;
    }
    const rotinaId = idDe(nome);
    // A composição vem da sessão MAIS RECENTE; as métricas, de todas.
    const modelo = [...lista[0].sessao_exercicios].sort((a, b) => a.ordem - b.ordem);
    if (!modelo.length) continue;

    rotinas.push({ id: rotinaId, user_id: uid, nome, ordem: ordemRotina++, arquivada: false });

    console.log(`\n${nome}  (${lista.length} sessões)`);
    modelo.forEach((ex, i) => {
      // Junta as reps deste exercício em TODAS as sessões deste treino.
      const todasReps: number[] = [];
      const seriesPorSessao: number[] = [];
      for (const s of lista) {
        const igual = s.sessao_exercicios.find((e) => e.exercicio_id === ex.exercicio_id);
        if (!igual) continue;
        const reps = igual.series.map((x) => x.reps).filter((r): r is number => r != null);
        if (reps.length) {
          todasReps.push(...reps);
          seriesPorSessao.push(reps.length);
        }
      }
      // Percentil, não min/max: uma série que falhou em 2 reps não pode virar
      // o piso da faixa, nem uma de 15 virar o teto.
      let min = percentil(todasReps, 0.2);
      let max = percentil(todasReps, 0.8);
      // Com poucas amostras o percentil degenera em min/max — e aí uma série
      // que falhou em 2 reps vira o piso da faixa (aconteceu na Rosca
      // Inclinada: 3 séries, saiu "2-7"). Nesse caso, banda em volta da
      // mediana. Idem quando a banda colapsa ("9-9" não é alvo, é número).
      if (todasReps.length < AMOSTRA_MINIMA || max - min < BANDA_MINIMA) {
        const centro = mediana(todasReps) || max || 8;
        min = Math.max(1, Math.round(centro - BANDA_MINIMA / 2));
        max = min + BANDA_MINIMA;
      }
      const seriesAlvo = mediana(seriesPorSessao) || 3;

      itens.push({
        id: idDe(`${nome}|${ex.exercicio_id}`),
        rotina_id: rotinaId,
        exercicio_id: ex.exercicio_id,
        ordem: i,
        series_alvo: seriesAlvo,
        reps_alvo_min: min || null,
        reps_alvo_max: max || null,
        descanso_seg: DESCANSO_PADRAO_SEG,
      });
      console.log(
        `  ${String(i + 1).padStart(2)}. ${ex.nome_snapshot.padEnd(38)} ` +
          `${seriesAlvo}× ${min}-${max} reps   (${todasReps.length} séries no histórico)`,
      );
    });
  }

  console.log(`\n${rotinas.length} rotinas · ${itens.length} exercícios`);
  if (dryRun) {
    console.log("--dry-run: nada foi escrito.");
    return;
  }

  const up = async (tabela: string, linhas: Record<string, unknown>[]) => {
    const { error } = await db.from(tabela).upsert(linhas, { onConflict: "id" });
    if (error) throw new Error(`${tabela}: ${error.message}`);
    console.log(`✓ ${tabela} ${linhas.length}`);
  };
  await up("rotinas", rotinas);
  await up("rotina_exercicios", itens);
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
