import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { haQuantoTempo, formatPeso } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExerciciosPage() {
  const supabase = await createClient();

  // Ordem do D-014: fixado, depois o mais recente, depois o mais usado. É o
  // histórico importado que faz isso funcionar já no dia 1.
  const { data: exercicios } = await supabase
    .from("exercicios")
    .select("id, nome, equipamento, usos, ultimo_uso_em")
    .eq("arquivado", false)
    .order("fixado", { ascending: false })
    .order("ultimo_uso_em", { ascending: false, nullsFirst: false })
    .order("usos", { ascending: false });

  return (
    <main className="flex-1 flex flex-col px-4 pt-safe pb-safe">
      <header className="pt-6 pb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Exercícios</h1>
        <span className="text-xs text-muted">{exercicios?.length ?? 0}</span>
      </header>

      <ul className="flex flex-col divide-y divide-border">
        {(exercicios ?? []).map((e) => (
          <li key={e.id}>
            <Link href={`/exercicios/${e.id}`} className="py-3 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate">{e.nome}</p>
              <p className="text-[11px] text-muted">
                {e.equipamento ?? "—"} · {e.usos} séries
              </p>
            </div>
            <span className="text-[11px] text-muted shrink-0">
              {e.ultimo_uso_em ? haQuantoTempo(e.ultimo_uso_em.slice(0, 10)) : "nunca"}
            </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <Link href="/" className="block py-3 text-center text-sm text-muted">Voltar</Link>
      </div>
    </main>
  );
}
