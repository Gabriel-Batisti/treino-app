import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListaRotinas, type RotinaDaLista } from "./lista-rotinas";

export const dynamic = "force-dynamic";

interface ItemRotina {
  ordem: number;
  exercicios: { nome: string } | null;
}

export default async function Rotinas() {
  const supabase = await createClient();

  const [{ data: rotinas }, { data: ultimas }] = await Promise.all([
    supabase
      .from("rotinas")
      // Traz as arquivadas também: a lista tem "mostrar ocultas".
      .select("id, nome, ordem, arquivada, rotina_exercicios(ordem, exercicios(nome))")
      .order("ordem"),
    supabase
      .from("sessoes")
      .select("nome, data_local")
      .eq("status", "concluida")
      .order("inicio_em", { ascending: false })
      .limit(60),
  ]);

  // Última vez que cada treino foi feito — casa por NOME, que é o que liga
  // rotina e histórico enquanto `sessoes.rotina_id` não é preenchido.
  const ultimaVez = new Map<string, string>();
  for (const s of ultimas ?? []) {
    if (s.nome && !ultimaVez.has(s.nome)) ultimaVez.set(s.nome, s.data_local);
  }

  const lista: RotinaDaLista[] = (rotinas ?? []).map((r) => ({
    id: r.id,
    nome: r.nome,
    arquivada: r.arquivada,
    ultimaVez: r.nome ? (ultimaVez.get(r.nome) ?? null) : null,
    exercicios: ((r.rotina_exercicios ?? []) as unknown as ItemRotina[])
      .sort((a, b) => a.ordem - b.ordem)
      .map((i) => i.exercicios?.nome)
      .filter(Boolean) as string[],
  }));

  return (
    <main className="flex-1 flex flex-col pt-safe px-4">
      <header className="pt-6 pb-2">
        <h1 className="text-2xl font-semibold tracking-tight">Treino</h1>
      </header>

      <Link
        href="/cardio"
        className="mt-2 rounded-2xl bg-card border border-border py-4 flex items-center justify-center gap-2 text-sm"
      >
        <span className="text-accent text-lg leading-none">＋</span>
        Registrar cardio
      </Link>

      <h2 className="mt-6 text-lg font-medium">Rotinas</h2>

      <ListaRotinas rotinas={lista} />

      <div className="h-6" />
    </main>
  );
}
