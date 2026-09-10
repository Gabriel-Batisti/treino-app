import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { haQuantoTempo } from "@/lib/format";

export const dynamic = "force-dynamic";

interface ItemRotina {
  ordem: number;
  exercicios: { nome: string } | null;
}

export default async function Home() {
  const supabase = await createClient();

  const [{ data: rotinas }, { data: ultimas }] = await Promise.all([
    supabase
      .from("rotinas")
      .select("id, nome, ordem, rotina_exercicios(ordem, exercicios(nome))")
      .eq("arquivada", false)
      .order("ordem"),
    supabase
      .from("sessoes")
      .select("nome, data_local")
      .eq("status", "concluida")
      .order("inicio_em", { ascending: false })
      .limit(40),
  ]);

  // Última vez que cada treino foi feito — casa por nome, que é o que liga
  // rotina e histórico enquanto sessoes.rotina_id não é preenchido.
  const ultimaVez = new Map<string, string>();
  for (const s of ultimas ?? []) {
    if (s.nome && !ultimaVez.has(s.nome)) ultimaVez.set(s.nome, s.data_local);
  }

  return (
    <main className="flex-1 flex flex-col pt-safe pb-safe">
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Treino</h1>
        <p className="mt-0.5 text-sm text-muted">
          {rotinas?.length ?? 0} {rotinas?.length === 1 ? "rotina" : "rotinas"}
        </p>
      </header>

      <section className="px-4 flex flex-col gap-3">
        {(rotinas ?? []).map((r) => {
          const nomes = ((r.rotina_exercicios ?? []) as unknown as ItemRotina[])
            .sort((a, b) => a.ordem - b.ordem)
            .map((i) => i.exercicios?.nome)
            .filter(Boolean) as string[];
          const feito = r.nome ? ultimaVez.get(r.nome) : null;

          return (
            <article key={r.id} className="rounded-2xl bg-card border border-border p-4">
              {/* O card inteiro leva pro DETALHE, não pro treino. Iniciar é uma
                  ação explícita — foi o que o usuário pediu ao comparar com o
                  Hevy: clicar na rotina não pode começar o treino. */}
              <Link href={`/rotinas/${r.id}`} className="block">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-medium">{r.nome}</h2>
                  {feito && (
                    <span className="text-[11px] text-muted shrink-0">{haQuantoTempo(feito)}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted line-clamp-2 leading-relaxed">
                  {nomes.join(", ")}
                </p>
              </Link>

              <Link
                href={`/sessao?rotina=${r.id}`}
                className="mt-3 block rounded-xl bg-accent text-black font-semibold py-3.5 text-center text-sm"
              >
                Começar rotina
              </Link>
            </article>
          );
        })}
      </section>

    </main>
  );
}
