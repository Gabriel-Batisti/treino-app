import { ilustracaoDe } from "@/lib/treino/ilustracoes";

/**
 * Ilustração do movimento: duas fotos (início e fim) alternando.
 *
 * Server Component — a troca de quadro é CSS puro, sem JS e sem hidratação.
 * Não é um gif: são dois quadros em corte seco, que é o que a base aberta
 * oferece. Animação de verdade só existe em base proprietária.
 *
 * Fundo branco de propósito: as fotos da base são sobre branco, e recortar
 * ficaria pior que assumir o cartão claro (o Hevy faz igual).
 */
export function Ilustracao({
  nomeBusca,
  className = "size-11",
  mostrarAviso = false,
}: {
  nomeBusca: string;
  className?: string;
  mostrarAviso?: boolean;
}) {
  const il = ilustracaoDe(nomeBusca);

  if (!il) {
    return (
      <span
        className={`${className} shrink-0 rounded-full bg-border grid place-items-center text-[10px] text-muted`}
        aria-hidden
      >
        ?
      </span>
    );
  }

  return (
    <span className={`${className} shrink-0 relative block overflow-hidden rounded-full bg-white`}>
      <img
        src={`/ex/${il.pasta}/0.webp`}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
      />
      <img
        src={`/ex/${il.pasta}/1.webp`}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full object-cover ilustracao-fim"
      />
      {mostrarAviso && il.aprox && (
        <span className="sr-only">ilustração aproximada</span>
      )}
    </span>
  );
}
