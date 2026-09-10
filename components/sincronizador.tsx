"use client";

import { useEffect, useState, useCallback } from "react";
import { sincronizar } from "@/lib/local/sync";
import { lerFila } from "@/lib/local/db";

/**
 * Roda a sincronização em segundo plano e mostra o estado quando há algo a
 * dizer. Montado no layout raiz.
 *
 * Só aparece quando importa: offline, ou com coisa na fila. Um selo permanente
 * de "sincronizado" seria ruído — o normal não precisa ser anunciado.
 *
 * D-009: falha aqui bloqueia SINCRONIZAÇÃO, nunca USO. Nada daqui derruba tela.
 */
export function Sincronizador() {
  const [pendentes, setPendentes] = useState(0);
  const [online, setOnline] = useState(true);
  const [rodando, setRodando] = useState(false);

  const rodar = useCallback(async () => {
    setRodando(true);
    try {
      const r = await sincronizar();
      setPendentes(r.pendentes);
    } catch {
      const fila = await lerFila();
      setPendentes(fila.length);
    } finally {
      setRodando(false);
    }
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    void rodar();

    const aoVoltar = () => {
      setOnline(true);
      void rodar();
    };
    const aoCair = () => setOnline(false);
    // Voltar pro app é o gatilho mais comum: o iOS suspende a aba em background.
    const aoAparecer = () => {
      if (document.visibilityState === "visible") {
        setOnline(navigator.onLine);
        void rodar();
      }
    };

    window.addEventListener("online", aoVoltar);
    window.addEventListener("offline", aoCair);
    document.addEventListener("visibilitychange", aoAparecer);
    return () => {
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener("offline", aoCair);
      document.removeEventListener("visibilitychange", aoAparecer);
    };
  }, [rodar]);

  if (online && pendentes === 0) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 pt-safe pointer-events-none">
      <div className="mx-auto mt-1 w-fit pointer-events-auto">
        <button
          onClick={() => void rodar()}
          disabled={rodando}
          className={`rounded-full px-3 py-1.5 text-[11px] border backdrop-blur ${
            pendentes > 0
              ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
              : "bg-card/90 border-border text-muted"
          }`}
        >
          {rodando
            ? "sincronizando…"
            : pendentes > 0
              ? `${pendentes} ${pendentes === 1 ? "treino" : "treinos"} a enviar`
              : "offline"}
        </button>
      </div>
    </div>
  );
}
