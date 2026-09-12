/**
 * Bipe do fim do descanso.
 *
 * NO iOS, ÁUDIO SÓ TOCA SE ALGUM GESTO SEU JÁ TIVER DESTRAVADO O SOM. Por isso
 * `prepararSom()` é chamado no ✓ da série: quando o descanso acabar, dois
 * minutos depois, não há gesto nenhum acontecendo e o navegador recusaria.
 *
 * Oscilador em vez de arquivo de som: zero bytes pra baixar, nada pra cachear
 * no service worker, e funciona offline por construção.
 *
 * `navigator.vibrate` NÃO existe no iOS — nem no Safari, nem no app instalado.
 * O canal é o som, e só.
 */

let ctx: AudioContext | null = null;

type ComWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

/** Chame dentro de um gesto do usuário. Barato e idempotente. */
export function prepararSom(): void {
  try {
    const Classe = window.AudioContext ?? (window as ComWebkit).webkitAudioContext;
    if (!Classe) return;
    ctx ??= new Classe();
    // O contexto nasce suspenso quando criado fora de gesto; retomar aqui é o
    // que faz o bipe de daqui a dois minutos sair.
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* sem áudio: o timer continua funcionando, só não apita */
  }
}

/** Dois bipes curtos. Sem gesto recente, o iOS ignora — e tudo bem. */
export function tocarBip(): void {
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const agora = ctx.currentTime;
    for (const atraso of [0, 0.28]) {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      // Rampa curta nas pontas: onda cortada no zero estala no alto-falante.
      ganho.gain.setValueAtTime(0.0001, agora + atraso);
      ganho.gain.exponentialRampToValueAtTime(0.35, agora + atraso + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.18);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(agora + atraso);
      osc.stop(agora + atraso + 0.2);
    }
  } catch {
    /* ignora */
  }
}

/**
 * Notificação do sistema, se você já autorizou (o mesmo pedido do lembrete
 * diário, D-020). Serve pra quando a tela apagou ou você saiu do app.
 *
 * Melhor esforço: com o app congelado pelo iOS, nada disto roda. É por isso
 * que o `wakeLock` da tela de treino continua sendo a defesa principal.
 */
export async function avisarDescansoAcabou(): Promise<void> {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.ready;
    await reg?.showNotification("Descanso acabou", {
      body: "Próxima série.",
      tag: "descanso",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      silent: false,
    });
  } catch {
    /* ignora */
  }
}
