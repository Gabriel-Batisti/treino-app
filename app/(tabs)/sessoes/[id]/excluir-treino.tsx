"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { excluirSessao } from "@/app/actions/treino";
import { sincronizar } from "@/lib/local/sync";

/**
 * Excluir treino, em dois toques.
 *
 * Confirmação inline em vez de `confirm()` do navegador: o diálogo nativo no
 * iOS aparece no topo da tela, longe do polegar, e não dá pra estilizar.
 *
 * Depois de excluir, `sincronizar()` atualiza o banco local — senão a tela de
 * treino seguiria mostrando o "anterior" do treino que você apagou.
 */
export function ExcluirTreino({ id, nome }: { id: string; nome: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function excluir() {
    setExcluindo(true);
    setErro(null);
    const r = await excluirSessao(id);
    if (!r.ok) {
      setErro(r.error);
      setExcluindo(false);
      return;
    }
    await sincronizar();
    router.push("/");
    router.refresh();
  }

  if (!confirmando) {
    return (
      <button
        onClick={() => setConfirmando(true)}
        className="w-full rounded-2xl border border-border py-4 text-sm text-red-400"
      >
        Excluir treino
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4">
      <p className="text-sm">
        Excluir <span className="font-medium">{nome}</span>?
      </p>
      <p className="mt-1 text-[11px] text-muted">
        Some do histórico e deixa de contar nos recordes e no &ldquo;anterior&rdquo;. Dá pra
        desfazer no banco — não é apagado de verdade.
      </p>
      {erro && <p className="mt-2 text-sm text-red-400">{erro}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setConfirmando(false)}
          disabled={excluindo}
          className="flex-1 rounded-xl border border-border py-3.5 text-sm"
        >
          Cancelar
        </button>
        <button
          onClick={excluir}
          disabled={excluindo}
          className="flex-1 rounded-xl bg-red-500 text-white font-semibold py-3.5 text-sm disabled:opacity-40"
        >
          {excluindo ? "excluindo…" : "Excluir"}
        </button>
      </div>
    </div>
  );
}
