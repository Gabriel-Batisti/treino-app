"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barra de abas fixa na base — zona do polegar.
 *
 * `pb-safe` é obrigatório aqui: com `viewportFit: "cover"` no layout, sem o
 * padding do `env(safe-area-inset-bottom)` a barra fica embaixo do home
 * indicator do iPhone e os toques não chegam.
 */

const ABAS = [
  { href: "/", rotulo: "Início", icone: InicioIcone },
  { href: "/rotinas", rotulo: "Treino", icone: TreinoIcone },
  { href: "/perfil", rotulo: "Perfil", icone: PerfilIcone },
] as const;

export function BarraAbas() {
  const caminho = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border pb-safe">
      <ul className="flex">
        {ABAS.map(({ href, rotulo, icone: Icone }) => {
          const ativa = href === "/" ? caminho === "/" : caminho.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={ativa ? "page" : undefined}
                // min-h-14: alvo de toque confortável mesmo com a mão suada.
                className={`flex flex-col items-center gap-1 min-h-14 pt-2 pb-1 ${
                  ativa ? "text-accent" : "text-muted"
                }`}
              >
                <Icone />
                <span className="text-[10px]">{rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function InicioIcone() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function TreinoIcone() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
    </svg>
  );
}

function PerfilIcone() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}
