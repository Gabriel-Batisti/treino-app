import { BarraAbas } from "@/components/barra-abas";

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
      <BarraAbas />
    </>
  );
}
