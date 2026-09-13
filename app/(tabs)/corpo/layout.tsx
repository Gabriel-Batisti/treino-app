import { SubAbasCorpo } from "./sub-abas";

/**
 * Casca de "Meu corpo": bioimpedância, medidas e fotos sob a mesma aba.
 *
 * Antes eram três rotas soltas (`/peso`, `/fotos`, e a bioimpedância escondida
 * dentro de peso), alcançáveis só por link no meio de outra tela. São a mesma
 * pergunta — "como está meu corpo" — e agora moram juntas.
 *
 * Sub-abas por ROTA, não por estado: cada uma continua Server Component, o
 * botão voltar do iPhone funciona entre elas, e o link do lembrete diário
 * aponta direto pra que interessa.
 */
export default function LayoutCorpo({ children }: LayoutProps<"/corpo">) {
  return (
    <main className="flex-1 flex flex-col pt-safe">
      <header className="px-4 pt-6 pb-1">
        <h1 className="text-2xl font-semibold tracking-tight">Meu corpo</h1>
      </header>
      <SubAbasCorpo />
      <div className="flex-1 flex flex-col">{children}</div>
    </main>
  );
}
