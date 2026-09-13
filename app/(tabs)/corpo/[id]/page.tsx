import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarExames, pesoMaisRecente } from "../dados";
import { DetalheExame } from "../detalhe-exame";
import { formatData } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExamePage({ params }: PageProps<"/corpo/[id]">) {
  const { id } = await params;
  const [{ exames }, pesoAtual] = await Promise.all([carregarExames(), pesoMaisRecente()]);

  const i = exames.findIndex((l) => l.id === id);
  if (i < 0) notFound();

  return (
    <div className="flex-1 flex flex-col px-4 pt-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/corpo/exames" className="text-xs text-muted">
          ‹ exames
        </Link>
        <span className="text-sm">{formatData(exames[i].data_local)}</span>
      </div>

      <div className="mt-4">
        <DetalheExame todos={exames} i={i} pesoAtual={pesoAtual} />
      </div>

      <div className="h-6" />
    </div>
  );
}
