"use client";

import { useState } from "react";
import { urlDoExame } from "@/app/actions/medidas";

/**
 * Abre o PDF original do exame.
 *
 * A URL é ASSINADA E CURTA (10 min, ver `urlDoExame`): o bucket é privado, e um
 * link permanente circulando é o mesmo que torná-lo público. Por isso o link só
 * é pedido quando você toca — não fica pronto na página.
 */
export function VerExame({ caminho }: { caminho: string }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setCarregando(true);
    setErro(null);
    const r = await urlDoExame(caminho);
    setCarregando(false);
    if (!r.ok) return setErro(r.error);
    window.open(r.data, "_blank", "noopener");
  }

  return (
    <div>
      <button
        onClick={() => void abrir()}
        disabled={carregando}
        className="w-full rounded-2xl border border-border py-4 text-sm disabled:opacity-40"
      >
        {carregando ? "abrindo…" : "Ver o PDF do exame"}
      </button>
      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
    </div>
  );
}
