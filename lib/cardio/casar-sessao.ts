/**
 * Casamento entre o treino do Apple Watch e a sessão registrada no app.
 *
 * O usuário registra musculação como "Outro" no relógio, então NÃO dá pra
 * decidir pelo tipo se é cardio ou academia. Quem decide é o horário: se existe
 * uma sessão do app sobrepondo o treino do relógio, são a mesma coisa — e os
 * batimentos e calorias pertencem a ela.
 */

/** Sobreposição exige folga: você encerra o relógio e o app em minutos diferentes. */
const FOLGA_MS = 30 * 60 * 1000;

export interface JanelaSessao {
  id: string;
  inicio_em: string;
  fim_em: string | null;
  apple_origem_id: string | null;
}

export interface ResultadoCasamento {
  sessao: JanelaSessao | null;
  /** Distância em minutos entre os inícios — só pra registro/diagnóstico. */
  distanciaMin: number | null;
}

/**
 * Acha a sessão que melhor corresponde ao treino do relógio.
 *
 * Critério: os dois intervalos se sobrepõem, considerando a folga. Entre várias
 * candidatas, vence a de início mais próximo — é o que resolve o caso de dois
 * treinos no mesmo dia.
 *
 * Sessão que JÁ absorveu outro treino do Apple é descartada: sem isso, dois
 * treinos do relógio no mesmo dia disputariam a mesma sessão e o segundo
 * sobrescreveria os números do primeiro.
 */
export function casarComSessao(
  sessoes: JanelaSessao[],
  appleInicio: Date,
  appleDuracaoMin: number,
  appleOrigemId: string,
): ResultadoCasamento {
  const ini = appleInicio.getTime();
  const fim = ini + appleDuracaoMin * 60_000;

  const candidatas = sessoes
    .filter((s) => !s.apple_origem_id || s.apple_origem_id === appleOrigemId)
    .map((s) => {
      const sIni = new Date(s.inicio_em).getTime();
      const sFim = s.fim_em ? new Date(s.fim_em).getTime() : sIni;
      const sobrepoe = sIni - FOLGA_MS <= fim && sFim + FOLGA_MS >= ini;
      return { s, sIni, sobrepoe };
    })
    .filter((c) => c.sobrepoe)
    .sort((a, b) => Math.abs(a.sIni - ini) - Math.abs(b.sIni - ini));

  const melhor = candidatas[0];
  if (!melhor) return { sessao: null, distanciaMin: null };
  return {
    sessao: melhor.s,
    distanciaMin: Math.round(Math.abs(melhor.sIni - ini) / 60_000),
  };
}
