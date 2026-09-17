import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormCardio, type CardioExistente } from "../form-cardio";

export const dynamic = "force-dynamic";

/**
 * Corrigir um cardio já gravado. Fora do grupo `(tabs)` pelo mesmo motivo do
 * registro novo: é tarefa com começo e fim, e a barra de abas competiria com o
 * botão de salvar na zona do polegar.
 */
export default async function EditarCardio({ params }: PageProps<"/cardio/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("cardios")
    .select(
      "id, tipo, data_local, inicio_em, duracao_min, calorias, fc_media, distancia_km, intensidade, fonte",
    )
    .eq("id", id)
    .is("excluido_em", null)
    .maybeSingle();

  if (!data) notFound();

  return <FormCardio cardio={data as CardioExistente} />;
}
