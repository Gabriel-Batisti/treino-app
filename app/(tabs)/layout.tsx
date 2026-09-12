import { BarraAbas } from "@/components/barra-abas";
import { TreinoEmAndamento } from "@/components/treino-em-andamento";

/**
 * Casca COM navegação.
 *
 * A sessão ativa (`/sessao`) mora FORA deste grupo de propósito: durante o
 * treino a tela é cheia, sem barra de abas nem nada que tire o polegar da
 * ação — ver "Duas cascas de layout" no CLAUDE.md.
 */
export default function LayoutComAbas({ children }: LayoutProps<"/">) {
  return (
    <>
      {/* pb pra o conteúdo não terminar embaixo da barra fixa. */}
      <div className="flex-1 flex flex-col pb-20">{children}</div>
      {/* Fica ACIMA da barra de abas: é a única coisa que pode interromper o
          que você veio fazer, e some assim que o treino é concluído. */}
      <TreinoEmAndamento />
      <BarraAbas />
    </>
  );
}
