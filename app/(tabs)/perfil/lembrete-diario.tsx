"use client";

import { useEffect, useState } from "react";
import { desinscreverPush, inscreverPush } from "@/app/actions/push";

/**
 * Liga/desliga o lembrete diário de pesagem neste aparelho.
 *
 * TRÊS COISAS QUE O iOS EXIGE, e que explicam o formato desta tela:
 *
 * 1. **Só funciona com o app instalado na tela de início.** No Safari comum,
 *    `window.Notification` nem existe. Por isso o estado "precisa instalar"
 *    é um estado de primeira classe aqui, e não um erro genérico.
 * 2. **A permissão só pode ser pedida dentro de um gesto do usuário** — daí
 *    ser um botão, e não algo que acontece ao abrir a tela. Pedir permissão
 *    sozinho também é a forma mais rápida de levar um "não" permanente.
 * 3. **Permissão negada é definitiva** pelo app: só volta em Ajustes do
 *    iPhone. A tela diz isso em vez de oferecer um botão que não faz nada.
 *
 * A inscrição é POR APARELHO: ligar no iPhone não liga no PC, e é assim que
 * o Web Push funciona mesmo.
 */

type Estado =
  | "carregando"
  | "sem_suporte"
  | "precisa_instalar"
  | "desligado"
  | "ligado"
  | "negado";

/**
 * A chave VAPID vai em base64url e o `subscribe` quer bytes.
 *
 * O `ArrayBuffer` explícito não é firula de tipagem: `Uint8Array` genérico
 * aceita `SharedArrayBuffer`, que `applicationServerKey` recusa.
 */
function base64ParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const cru = atob(normal);
  const bytes = new Uint8Array(new ArrayBuffer(cru.length));
  for (let i = 0; i < cru.length; i++) bytes[i] = cru.charCodeAt(i);
  return bytes;
}

export function LembreteDiario() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;

      const instalado =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // Safari fora do app instalado cai exatamente aqui.
        setEstado(instalado ? "sem_suporte" : "precisa_instalar");
        return;
      }
      if (Notification.permission === "denied") return setEstado("negado");

      const reg = await navigator.serviceWorker.ready;
      const inscricao = await reg.pushManager.getSubscription();
      setEstado(inscricao ? "ligado" : "desligado");
    })().catch(() => setEstado("sem_suporte"));
  }, []);

  async function ligar() {
    setOcupado(true);
    setErro(null);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "negado" : "desligado");
        return;
      }

      const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!chave) {
        setErro("Falta a chave VAPID no ambiente.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const inscricao =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ParaBytes(chave),
        }));

      const cru = inscricao.toJSON();
      const r = await inscreverPush({
        endpoint: inscricao.endpoint,
        p256dh: cru.keys?.p256dh ?? "",
        auth: cru.keys?.auth ?? "",
        apelido: navigator.userAgent.slice(0, 80),
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setEstado("ligado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não consegui ativar");
    } finally {
      setOcupado(false);
    }
  }

  async function desligar() {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const inscricao = await reg.pushManager.getSubscription();
      if (inscricao) {
        await desinscreverPush(inscricao.endpoint);
        await inscricao.unsubscribe();
      }
      setEstado("desligado");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "carregando") return null;

  const textos: Record<Exclude<Estado, "carregando">, { titulo: string; detalhe: string }> = {
    precisa_instalar: {
      titulo: "Lembrete diário",
      detalhe:
        "Precisa do app instalado na tela de início — no Safari o iOS não entrega notificação. Compartilhar › Adicionar à Tela de Início.",
    },
    sem_suporte: {
      titulo: "Lembrete diário",
      detalhe: "Este navegador não suporta notificação.",
    },
    negado: {
      titulo: "Lembrete diário",
      detalhe: "Notificação bloqueada. Libere em Ajustes › Notificações › Treino.",
    },
    desligado: {
      titulo: "Lembrete diário",
      detalhe: "Um toque de manhã pra registrar o peso. Só chega se você ainda não pesou.",
    },
    ligado: {
      titulo: "Lembrete diário ligado",
      detalhe: "Chega entre 7h e 8h, e só nos dias em que você ainda não registrou.",
    },
  };

  const t = textos[estado];

  return (
    <section className="mt-3 rounded-2xl bg-card border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm">{t.titulo}</p>
          <p className="mt-1 text-[11px] text-muted leading-relaxed">{t.detalhe}</p>
        </div>
        {(estado === "desligado" || estado === "ligado") && (
          <button
            onClick={estado === "ligado" ? desligar : ligar}
            disabled={ocupado}
            className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-medium disabled:opacity-40 ${
              estado === "ligado" ? "border border-border text-muted" : "bg-accent text-black"
            }`}
          >
            {ocupado ? "…" : estado === "ligado" ? "Desligar" : "Ligar"}
          </button>
        )}
      </div>
      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
    </section>
  );
}
