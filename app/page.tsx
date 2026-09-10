import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDataCurta, haQuantoTempo } from "@/lib/format";

// O CDN da Vercel cacheia HTML e o histórico mudaria só no próximo deploy.
export const dynamic = "force-dynamic";

interface Modelo {
  nome: string;
  ultimaData: string;
  exercicios: string[];
}

export default async function Home() {
  const supabase = await createClient();

  const { data: sessoes } = await supabase
    .from("sessoes")
    .select("id, nome, data_local, inicio_em, sessao_exercicios(nome_snapshot, ordem)")
    .eq("status", "concluida")
    .order("inicio_em", { ascending: false })
    .limit(60);

  // Um card por NOME de treino, com a composição da vez mais recente. É assim
  // que ele treina: "Treino 1".."Treino 5" se repetem.
  const modelos = new Map<string, Modelo>();
  for (const s of sessoes ?? []) {
    const nome = s.nome?.trim();
    if (!nome || modelos.has(nome)) continue;
    const exs = (s.sessao_exercicios as { nome_snapshot: string; ordem: number }[] ?? [])
      .sort((a, b) => a.ordem - b.ordem)
      .map((e) => e.nome_snapshot);
    modelos.set(nome, { nome, ultimaData: s.data_local, exercicios: exs });
  }
  const lista = [...modelos.values()].slice(0, 8);

  const { count: totalSeries } = await supabase
    .from("series").select("*", { count: "exact", head: true });

  return (
    <main className="flex-1 flex flex-col px-4 pt-safe pb-safe">
      <header className="pt-6 pb-4">
        <h1 className="text-3xl font-semibold tracking-tight">Treino</h1>
        <p className="mt-1 text-sm text-muted">
          {sessoes?.length ? `${totalSeries} séries no histórico` : "sem histórico ainda"}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        {lista.map((m) => (
          <Link
            key={m.nome}
            href={`/treino?modelo=${encodeURIComponent(m.nome)}`}
            className="rounded-2xl bg-card border border-border p-4 active:border-accent"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-lg font-medium">{m.nome}</span>
              <span className="text-xs text-muted shrink-0">
                {haQuantoTempo(m.ultimaData)} · {formatDataCurta(m.ultimaData)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted line-clamp-2">
              {m.exercicios.length} exercícios · {m.exercicios.slice(0, 3).join(" · ")}
              {m.exercicios.length > 3 ? " · …" : ""}
            </p>
          </Link>
        ))}
      </section>

      {/* Zona do polegar: a ação primária mora embaixo, não no header. */}
      <div className="mt-auto pt-6 flex flex-col gap-2">
        <Link
          href="/treino"
          className="rounded-2xl bg-accent text-black font-semibold py-5 text-center text-base"
        >
          Treino livre
        </Link>
        <Link href="/exercicios" className="py-3 text-center text-sm text-muted">
          Ver exercícios
        </Link>
      </div>
    </main>
  );
}
