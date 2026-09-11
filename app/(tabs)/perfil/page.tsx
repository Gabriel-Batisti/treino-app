import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatData } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Perfil() {
  const supabase = await createClient();

  const [{ data: auth }, { count: totalSessoes }, { count: totalSeries }, { data: primeira }] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase.from("sessoes").select("*", { count: "exact", head: true }).eq("status", "concluida"),
      supabase.from("series").select("*", { count: "exact", head: true }),
      supabase
        .from("sessoes")
        .select("data_local")
        .eq("status", "concluida")
        .order("inicio_em", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  const { data: volume } = await supabase.from("series").select("volume_kg").not("volume_kg", "is", null);
  const volumeTotal = Math.round((volume ?? []).reduce((n, x) => n + Number(x.volume_kg), 0));

  return (
    <main className="flex-1 flex flex-col pt-safe px-4">
      <header className="pt-6 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="mt-0.5 text-sm text-muted">{auth.user?.email}</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {[
          ["Treinos", (totalSessoes ?? 0).toLocaleString("pt-BR")],
          ["Séries", (totalSeries ?? 0).toLocaleString("pt-BR")],
          ["Volume total", `${volumeTotal.toLocaleString("pt-BR")} kg`],
          ["Desde", primeira ? formatData(primeira.data_local) : "—"],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-2xl bg-card border border-border p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted">{rotulo}</p>
            <p className="mt-0.5 text-lg tabular-nums">{valor}</p>
          </div>
        ))}
      </div>

      <nav className="mt-6 flex flex-col rounded-2xl bg-card border border-border divide-y divide-border">
        <Link href="/peso" className="px-4 py-4 flex items-center justify-between">
          <span>Peso e bioimpedância</span>
          <span className="text-muted">›</span>
        </Link>
        <Link href="/exercicios" className="px-4 py-4 flex items-center justify-between">
          <span>Exercícios</span>
          <span className="text-muted">›</span>
        </Link>
        <Link href="/cardio" className="px-4 py-4 flex items-center justify-between">
          <span>Registrar cardio</span>
          <span className="text-muted">›</span>
        </Link>
      </nav>
    </main>
  );
}
