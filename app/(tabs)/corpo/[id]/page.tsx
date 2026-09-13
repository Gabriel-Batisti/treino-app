import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CartaoMedida, type PontoHistorico } from "@/components/cartao-medida";
import { Segmentar } from "../segmentar";
import { VerExame } from "./ver-exame";
import { formatData } from "@/lib/format";
import type { LeituraInbody } from "@/lib/medidas/inbody";

export const dynamic = "force-dynamic";

interface Linha {
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

/** Série histórica de um número, do mais antigo pro mais novo. */
function serie(linhas: Linha[], pega: (l: Linha) => number | null | undefined): PontoHistorico[] {
  return [...linhas]
    .reverse()
    .map((l) => ({ data: l.data_local, valor: pega(l) }))
    .filter((p): p is PontoHistorico => p.valor != null);
}

export default async function ExamePage({ params }: PageProps<"/corpo/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  // Todos os exames de uma vez: o histórico de cada número sai daqui, e são
  // poucas linhas (bioimpedância é de dois em dois meses). As listas de colunas
  // são LITERAIS — concatenadas, o supabase-js perde o tipo do retorno.
  const comDados = await supabase
    .from("medidas")
    .select(
      "id, data_local, peso_kg, gordura_pct, massa_magra_kg, massa_muscular_kg, massa_gorda_kg, agua_pct, gordura_visceral, tmb_kcal, arquivo_path, dados",
    )
    .eq("origem", "bioimpedancia")
    .is("excluido_em", null)
    .order("data_local", { ascending: false });

  const semDados = comDados.error
    ? await supabase
        .from("medidas")
        .select(
          "id, data_local, peso_kg, gordura_pct, massa_magra_kg, massa_muscular_kg, massa_gorda_kg, agua_pct, gordura_visceral, tmb_kcal, arquivo_path",
        )
        .eq("origem", "bioimpedancia")
        .is("excluido_em", null)
        .order("data_local", { ascending: false })
    : null;

  const data = comDados.error ? semDados?.data : comDados.data;

  const todos = (data ?? []) as unknown as Linha[];
  const i = todos.findIndex((l) => l.id === id);
  if (i < 0) notFound();

  const exame = todos[i];
  // "Anterior" é o exame imediatamente mais antigo, não o último da lista.
  const anterior = todos[i + 1] ?? null;
  const d = exame.dados ?? null;
  const dAnterior = anterior?.dados ?? null;

  const delta = (a: number | null | undefined, b: number | null | undefined) =>
    a != null && b != null ? Math.round((a - b) * 100) / 100 : null;

  // O histórico de cada cartão vai só até este exame: abrir um laudo antigo e
  // ver a linha continuar pra frente seria mentira sobre o que se sabia ali.
  const ate = todos.slice(i);

  return (
    <div className="flex-1 flex flex-col px-4 pt-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/corpo" className="text-xs text-muted">
          ‹ exames
        </Link>
        <span className="text-sm">{formatData(exame.data_local)}</span>
      </div>

      {!d && (
        <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          Este exame ainda não tem o laudo completo lido. Rode a migration 0010 e
          depois <code>npx tsx scripts/reler-exames.ts</code>.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        <CartaoMedida
          rotulo="Peso"
          valor={exame.peso_kg}
          sufixo=" kg"
          delta={delta(exame.peso_kg, anterior?.peso_kg)}
          faixa={d?.faixas?.peso}
          historico={serie(ate, (l) => l.peso_kg)}
        />

        {d?.imc != null && (
          <CartaoMedida
            rotulo="IMC"
            valor={d.imc}
            casas={1}
            delta={delta(d.imc, dAnterior?.imc)}
            // 18,5–25 é a faixa da OMS, universal — não é conta minha nem do
            // aparelho, por isso pode ser desenhada sem vir do laudo.
            faixa={{ min: 18.5, max: 25 }}
            historico={serie(ate, (l) => l.dados?.imc)}
            subirEhRuim
          />
        )}

        <CartaoMedida
          rotulo="Gordura corporal"
          valor={exame.gordura_pct}
          sufixo=" %"
          delta={delta(exame.gordura_pct, anterior?.gordura_pct)}
          historico={serie(ate, (l) => l.gordura_pct)}
          subirEhRuim
        />

        <CartaoMedida
          rotulo="Massa de gordura"
          valor={exame.massa_gorda_kg ?? d?.massa_gorda_kg ?? null}
          sufixo=" kg"
          delta={delta(exame.massa_gorda_kg ?? d?.massa_gorda_kg, anterior?.massa_gorda_kg)}
          faixa={d?.faixas?.gordura}
          historico={serie(ate, (l) => l.massa_gorda_kg ?? l.dados?.massa_gorda_kg)}
          subirEhRuim
        />

        <CartaoMedida
          rotulo="Massa muscular esquelética"
          valor={exame.massa_muscular_kg}
          sufixo=" kg"
          delta={delta(exame.massa_muscular_kg, anterior?.massa_muscular_kg)}
          historico={serie(ate, (l) => l.massa_muscular_kg)}
        />

        <CartaoMedida
          rotulo="Massa magra"
          valor={exame.massa_magra_kg}
          sufixo=" kg"
          delta={delta(exame.massa_magra_kg, anterior?.massa_magra_kg)}
          historico={serie(ate, (l) => l.massa_magra_kg)}
        />

        {d?.agua_l != null && (
          <CartaoMedida
            rotulo="Água corporal"
            valor={d.agua_l}
            sufixo=" L"
            delta={delta(d.agua_l, dAnterior?.agua_l)}
            faixa={d.faixas?.agua}
            historico={serie(ate, (l) => l.dados?.agua_l)}
          />
        )}

        <CartaoMedida
          rotulo="Gordura visceral"
          valor={exame.gordura_visceral}
          casas={0}
          delta={delta(exame.gordura_visceral, anterior?.gordura_visceral)}
          faixa={d?.faixas?.visceral}
          historico={serie(ate, (l) => l.gordura_visceral)}
          subirEhRuim
        />

        <CartaoMedida
          rotulo="Metabolismo basal"
          valor={exame.tmb_kcal}
          sufixo=" kcal"
          casas={0}
          delta={delta(exame.tmb_kcal, anterior?.tmb_kcal)}
          historico={serie(ate, (l) => l.tmb_kcal)}
        />

        {d?.proteina_kg != null && (
          <CartaoMedida
            rotulo="Proteína"
            valor={d.proteina_kg}
            sufixo=" kg"
            delta={delta(d.proteina_kg, dAnterior?.proteina_kg)}
            faixa={d.faixas?.proteina}
            historico={serie(ate, (l) => l.dados?.proteina_kg)}
          />
        )}

        {d?.minerais_kg != null && (
          <CartaoMedida
            rotulo="Minerais"
            valor={d.minerais_kg}
            sufixo=" kg"
            delta={delta(d.minerais_kg, dAnterior?.minerais_kg)}
            faixa={d.faixas?.minerais}
            historico={serie(ate, (l) => l.dados?.minerais_kg)}
          />
        )}

        {d?.segmentar && (
          <Segmentar
            magra={d.segmentar.magra}
            gordura={d.segmentar.gordura}
            anterior={dAnterior?.segmentar}
          />
        )}

        {d && (
          <section className="rounded-2xl bg-card border border-border p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted">Do laudo</p>
            <dl className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
              {(
                [
                  ["Pontuação InBody", d.pontuacao, ""],
                  ["Peso ideal", d.peso_ideal_kg, " kg"],
                  ["Controle de peso", d.controle_peso_kg, " kg"],
                  ["Controle de gordura", d.controle_gordura_kg, " kg"],
                  ["Controle muscular", d.controle_muscular_kg, " kg"],
                  ["Cintura-quadril", d.cintura_quadril, ""],
                  ["Grau de obesidade", d.grau_obesidade_pct, " %"],
                  ["Altura", d.altura_cm, " cm"],
                ] as [string, number | null, string][]
              )
                .filter(([, v]) => v != null)
                .map(([rotulo, v, sufixo]) => (
                  <div key={rotulo}>
                    <dt className="text-[10px] uppercase tracking-wide text-muted">{rotulo}</dt>
                    <dd className="tabular-nums">
                      {v!.toLocaleString("pt-BR")}
                      {sufixo}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        )}

        {exame.arquivo_path && <VerExame caminho={exame.arquivo_path} />}
      </div>

      <div className="h-6" />
    </div>
  );
}
