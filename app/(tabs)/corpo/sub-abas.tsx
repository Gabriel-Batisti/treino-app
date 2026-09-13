"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * As sub-abas de "Meu corpo".
 *
 * Client Component só por causa do `usePathname` — o conteúdo de cada aba
 * continua renderizado no servidor.
 */
const ABAS = [
  { href: "/corpo", rotulo: "Bioimpedância" },
  { href: "/corpo/medidas", rotulo: "Peso" },
  { href: "/corpo/fita", rotulo: "Medidas" },
  { href: "/corpo/fotos", rotulo: "Fotos" },
] as const;

export function SubAbasCorpo() {
  const caminho = usePathname();

  return (
    <nav className="px-4 pt-2 border-b border-border">
      <ul className="flex gap-1">
        {ABAS.map(({ href, rotulo }) => {
          // `/corpo` casaria com tudo: exige igualdade pra aba raiz.
          const ativa = href === "/corpo" ? caminho === "/corpo" : caminho.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={ativa ? "page" : undefined}
                className={`block text-center text-xs py-3 border-b-2 -mb-px ${
                  ativa
                    ? "border-accent text-accent font-medium"
                    : "border-transparent text-muted"
                }`}
              >
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
