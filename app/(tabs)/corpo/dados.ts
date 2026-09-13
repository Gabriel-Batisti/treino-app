import { createClient } from "@/lib/supabase/server";
import type { LeituraInbody } from "@/lib/medidas/inbody";

/**
 * Leitura dos exames, compartilhada pelas três telas de bioimpedância.
 *
 * Traz TODOS de uma vez porque o histórico de cada cartão sai daqui e são
 * poucas linhas — bioimpedância é de dois em dois meses, não diária.
 */

export interface LinhaExame {
  id: string;
  data_local: string;
  peso_kg: number;
  gordura_pct: number | null;
  massa_magra_kg: number | null;
  massa_muscular_kg: number | null;
  massa_gorda_kg: number | null;
  agua_pct: number | null;
  gordura_visceral: number | null;
  tmb_kcal: number | null;
  arquivo_path: string | null;
  dados: LeituraInbody | null;
}

const COLUNAS =
  "id, data_local, peso_kg, gordura_pct, massa_magra_kg, massa_muscular_kg, massa_gorda_kg, agua_pct, gordura_visceral, tmb_kcal, arquivo_path, dados";
// Sem `dados`: a 0010 pode não ter rodado, e a tela não pode quebrar por isso.
const COLUNAS_SEM_DADOS = COLUNAS.replace(", dados", "");

export async function carregarExames(): Promise<{
  exames: LinhaExame[];
  faltaDados: boolean;
}> {
  const supabase = await createClient();

  const comDados = await supabase
    .from("medidas")
    .select(COLUNAS)
    .eq("origem", "bioimpedancia")
    .is("excluido_em", null)
    .order("data_local", { ascending: false });

  if (!comDados.error) {
    return { exames: (comDados.data ?? []) as unknown as LinhaExame[], faltaDados: false };
  }

  const semDados = await supabase
    .from("medidas")
    .select(COLUNAS_SEM_DADOS)
    .eq("origem", "bioimpedancia")
    .is("excluido_em", null)
    .order("data_local", { ascending: false });

  return { exames: (semDados.data ?? []) as unknown as LinhaExame[], faltaDados: true };
}

/**
 * A pesagem mais recente de QUALQUER origem.
 *
 * A bioimpedância é de dois em dois meses e envelhece rápido: ver "82 kg" de
 * agosto sem saber que hoje é 81,4 leva a conclusão errada. Por isso o peso
 * do exame vem acompanhado do peso de hoje.
 */
export async function pesoMaisRecente(): Promise<{ valor: number; data: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("medidas")
    .select("peso_kg, data_local")
    .is("excluido_em", null)
    .order("data_local", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? { valor: Number(data.peso_kg), data: data.data_local } : null;
}
