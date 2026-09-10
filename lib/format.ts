/**
 * Formatação pt-BR. `timeZone` SEMPRE explícito: o servidor da Vercel roda em
 * UTC e sem isso o treino das 21h aparece com a data do dia seguinte.
 */
const FUSO = "America/Sao_Paulo";

const DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: FUSO,
});
const DATA_CURTA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "short", timeZone: FUSO,
});

/** Aceita "2026-09-10" (data_local) ou ISO completo. */
export function formatData(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  const d = valor instanceof Date
    ? valor
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T12:00:00-03:00` : valor);
  return Number.isNaN(d.getTime()) ? "—" : DATA.format(d);
}

export function formatDataCurta(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  const d = valor instanceof Date
    ? valor
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T12:00:00-03:00` : valor);
  return Number.isNaN(d.getTime()) ? "—" : DATA_CURTA.format(d);
}

/** "hoje", "ontem", "há 5 dias", "há 3 semanas" — o rótulo do "anterior". */
export function haQuantoTempo(dataLocal: string | null | undefined): string {
  if (!dataLocal) return "";
  const alvo = new Date(`${dataLocal}T12:00:00-03:00`);
  if (Number.isNaN(alvo.getTime())) return "";
  const hojeStr = new Date().toLocaleDateString("sv-SE", { timeZone: FUSO });
  const hoje = new Date(`${hojeStr}T12:00:00-03:00`);
  const dias = Math.round((+hoje - +alvo) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 14) return "há 1 semana";
  if (dias < 60) return `há ${Math.round(dias / 7)} semanas`;
  return `há ${Math.round(dias / 30)} meses`;
}

/** 22.5 → "22,5"   ·   80 → "80" */
export function formatPeso(kg: number | null | undefined): string {
  if (kg == null || !Number.isFinite(kg)) return "—";
  return kg.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Data local de HOJE no fuso de SP — é isto que vai em `sessoes.data_local` (D-012). */
export function hojeLocal(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: FUSO });
}
