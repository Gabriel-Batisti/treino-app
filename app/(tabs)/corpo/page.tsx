import Link from "next/link";
import { carregarExames, pesoMaisRecente } from "./dados";
import { DetalheExame } from "./detalhe-exame";
import { formatData } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * A aba abre no exame MAIS RECENTE, não numa lista.
 *
 * Lista é o que você vê quando quer comparar; no dia a dia a pergunta é "como
 * eu estou", e a resposta é o último exame. A lista continua a um toque.
 */
export default async function Corpo() {
  const [{ exames, faltaDados }, pesoAtual] = await Promise.all([
    carregarExames(),
    pesoMaisRecente(),
  ]);

  if (exames.length === 0) {
    return (
      <div className="flex-1 flex flex-col px-4 pt-4">
        <div className="flex justify-end">
          <Link
            href="/bioimpedancia"
            className="rounded-full border border-border px-4 py-2 text-xs text-accent"
          >
            + Bioimpedância
          </Link>
        </div>
        <p className="py-16 text-center text-sm text-muted">
          Nenhuma bioimpedância ainda.
          <br />
          Suba o PDF do exame — o app lê os números sozinho.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-4 pt-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">{formatData(exames[0].data_local)}</span>
        <div className="flex items-center gap-2">
          {exames.length > 1 && (
            <Link
              href="/corpo/exames"
              className="rounded-full border border-border px-3.5 py-2 text-xs"
            >
              Ver exames ({exames.length})
            </Link>
          )}
          <Link
            href="/bioimpedancia"
            className="rounded-full border border-border px-3.5 py-2 text-xs text-accent"
          >
            + Bio
          </Link>
        </div>
      </div>

      {faltaDados && (
        <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          Rode a migration <code>0010</code> pra ver o laudo completo.
        </p>
      )}

      <div className="mt-4">
        <DetalheExame todos={exames} i={0} pesoAtual={pesoAtual} />
      </div>

      <div className="h-6" />
    </div>
  );
}
