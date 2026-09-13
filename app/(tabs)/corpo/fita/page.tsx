import { createClient } from "@/lib/supabase/server";
import { SITES, nomeDoSite } from "@/lib/medidas/sites";
import { MiniGrafico } from "@/components/mini-grafico";
import { RegistrarFita } from "./registrar-fita";
import { formatData, hojeLocal } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Registro {
  id: string;
  data_local: string;
  valores: Record<string, number>;
  notas: string | null;
}

/**
 * Medidas de fita — cintura, braço, coxa.
 *
 * Um cartão por ponto do corpo, com o valor mais recente, a variação desde a
 * medição anterior e a linha do tempo. Ponto nunca medido não aparece: a tela
 * mostra o que existe, não quatorze campos vazios.
 */
export default async function Fita() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("medidas_corpo")
    .select("id, data_local, valores, notas")
    .is("excluido_em", null)
    .order("data_local", { ascending: false });

  const faltaMigration = !!error;
  const registros = (data ?? []) as unknown as Registro[];
  const ultimo = registros[0];

  // Só os pontos que já foram medidos alguma vez, na ordem de `sites.ts`.
  const medidos = SITES.filter((s) => registros.some((r) => r.valores?.[s.chave] != null));

  return (
    <div className="flex-1 flex flex-col px-4 pt-4">
      <RegistrarFita
        hoje={hojeLocal()}
        ultimo={ultimo ? { data: ultimo.data_local, valores: ultimo.valores } : null}
      />

      {faltaMigration && (
        <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          Tabela <code>medidas_corpo</code> não existe ainda — rode a migration 0011.
        </p>
      )}

      {!faltaMigration && registros.length === 0 && (
        <p className="py-16 text-center text-sm text-muted">
          Nenhuma medida ainda.
          <br />
          A primeira é a régua das outras — vale medir com calma.
        </p>
      )}

      {medidos.length > 0 && (
        <>
          <p className="mt-6 text-[11px] text-muted">
            Última medição: {formatData(ultimo.data_local)}
          </p>

          <div className="mt-2 flex flex-col gap-3">
            {medidos.map((s) => {
              const historico = [...registros]
                .reverse()
                .filter((r) => r.valores?.[s.chave] != null)
                .map((r) => ({ data: r.data_local, valor: Number(r.valores[s.chave]) }));

              const atual = historico[historico.length - 1];
              const antes = historico[historico.length - 2];
              const delta =
                atual && antes ? Math.round((atual.valor - antes.valor) * 10) / 10 : null;

              return (
                <section key={s.chave} className="rounded-2xl bg-card border border-border p-4">
                  <p className="text-xs font-medium">{nomeDoSite(s.chave)}</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl tabular-nums">
                      {atual.valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                      <span className="text-sm text-muted"> cm</span>
                    </span>
                    {delta != null && delta !== 0 && (
                      <span className="text-xs tabular-nums text-muted">
                        {delta > 0 ? "↑" : "↓"} {Math.abs(delta).toLocaleString("pt-BR")} cm
                      </span>
                    )}
                  </div>
                  <MiniGrafico historico={historico} casas={1} />
                </section>
              );
            })}
          </div>
        </>
      )}

      <div className="h-6" />
    </div>
  );
}
