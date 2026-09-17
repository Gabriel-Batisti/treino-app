import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hojeLocal } from "@/lib/format";
import { EditarTreino, type ExercicioEditavel } from "./editar-treino";

export const dynamic = "force-dynamic";

interface SerieCrua {
  id: string;
  indice: number;
  tipo: string;
  peso_kg: number | null;
  reps: number | null;
}

interface ExCru {
  ordem: number;
  nome_snapshot: string;
  exercicios: { nome_busca: string } | null;
  series: SerieCrua[];
}

export default async function EditarTreinoPage({ params }: PageProps<"/sessoes/[id]/editar">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: sessao } = await supabase
    .from("sessoes")
    .select(
      "id, nome, data_local, duracao_seg, notas, fc_media, fc_max, calorias, sessao_exercicios(ordem, nome_snapshot, exercicios(nome_busca), series(id, indice, tipo, peso_kg, reps, excluido_em))",
    )
    .eq("id", id)
    .eq("status", "concluida")
    .maybeSingle();

  if (!sessao) notFound();

  const exercicios: ExercicioEditavel[] = ((sessao.sessao_exercicios ?? []) as unknown as ExCru[])
    .sort((a, b) => a.ordem - b.ordem)
    .map((e) => ({
      chave: `${e.ordem}-${e.nome_snapshot}`,
      nome: e.nome_snapshot,
      nomeBusca: e.exercicios?.nome_busca ?? "",
      // Série já excluída não volta a aparecer — senão o ✕ viraria um botão
      // que não faz nada visível e a lista cresceria a cada correção.
      series: (e.series ?? [])
        .filter((s) => !(s as SerieCrua & { excluido_em: string | null }).excluido_em)
        .sort((a, b) => a.indice - b.indice),
    }))
    .filter((e) => e.series.length > 0);

  return (
    <EditarTreino
      hoje={hojeLocal()}
      treino={{
        id: sessao.id,
        nome: sessao.nome,
        data_local: sessao.data_local,
        // `duracao_seg` é coluna gerada; a tela edita minutos e a action
        // converte de volta pra `fim_em`.
        duracao_min: Math.max(1, Math.round((sessao.duracao_seg ?? 0) / 60)),
        fc_media: sessao.fc_media,
        fc_max: sessao.fc_max,
        calorias: sessao.calorias,
        notas: sessao.notas,
        exercicios,
      }}
    />
  );
}
