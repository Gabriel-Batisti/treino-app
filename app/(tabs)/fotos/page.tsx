import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GaleriaFotos, type DiaComFotos } from "./galeria-fotos";

export const dynamic = "force-dynamic";

interface Foto {
  id: string;
  data_local: string;
  angulo: string;
  arquivo_path: string;
  largura: number | null;
  altura: number | null;
}

export default async function Fotos() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fotos")
    .select("id, data_local, angulo, arquivo_path, largura, altura")
    .is("excluido_em", null)
    .order("data_local", { ascending: false })
    .limit(300);

  const faltaMigration = !!error;
  const fotos = (data ?? []) as Foto[];

  // URLs assinadas em lote — uma chamada por foto deixaria a galeria lenta.
  let urls: Record<string, string> = {};
  if (fotos.length) {
    const { data: assinadas } = await supabase.storage
      .from("fotos")
      .createSignedUrls(fotos.map((f) => f.arquivo_path), 60 * 60);
    for (const item of assinadas ?? []) {
      if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
    }
  }

  // Peso do dia, quando existe — é o que dá escala à foto.
  const { data: medidas } = await supabase
    .from("medidas")
    .select("data_local, peso_kg")
    .is("excluido_em", null)
    .then((r) => r, () => ({ data: null }));

  const pesoPorDia = new Map<string, number>();
  for (const m of (medidas ?? []) as { data_local: string; peso_kg: number }[]) {
    // Se houver mais de uma pesagem no dia, a primeira basta.
    if (!pesoPorDia.has(m.data_local)) pesoPorDia.set(m.data_local, Number(m.peso_kg));
  }

  // Agrupa por data, da mais recente pra mais antiga.
  const porDia = new Map<string, DiaComFotos>();
  for (const f of fotos) {
    const dia = porDia.get(f.data_local) ?? {
      data: f.data_local,
      pesoKg: pesoPorDia.get(f.data_local) ?? null,
      fotos: [],
    };
    dia.fotos.push({
      id: f.id,
      angulo: f.angulo,
      url: urls[f.arquivo_path] ?? null,
      largura: f.largura,
      altura: f.altura,
    });
    porDia.set(f.data_local, dia);
  }

  const dias = [...porDia.values()];

  return (
    <main className="flex-1 flex flex-col pt-safe px-4">
      <header className="pt-6 pb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Fotos</h1>
        <Link
          href="/foto-nova"
          className="rounded-full border border-border px-4 py-2 text-xs text-accent shrink-0"
        >
          + Foto
        </Link>
      </header>

      {faltaMigration && (
        <p className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          Tabela <code>fotos</code> não existe ainda — rode a migration 0004 no Supabase.
        </p>
      )}

      {dias.length === 0 && !faltaMigration ? (
        <p className="py-16 text-center text-sm text-muted">
          Nenhuma foto ainda.
          <br />
          A primeira é a mais importante — é a régua das outras.
        </p>
      ) : (
        <GaleriaFotos dias={dias} />
      )}

      <div className="h-6" />
    </main>
  );
}
