import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { tokenConfere } from "@/lib/cardio/token";
import { processarTreino } from "@/lib/cardio/processar";
import { janelaDoTreino, lerData, parear } from "@/lib/cardio/janela";

/**
 * Fim do treino no relógio, montado pelo Atalho do iOS.
 *
 * O ATALHO NÃO CALCULA NADA. Ele manda as amostras cruas de frequência
 * cardíaca e de energia ativa como texto separado por vírgula, e a conta é
 * feita aqui. Isso é de propósito:
 *
 *   - "Calcular Estatísticas" é mais uma ação pra montar naquela interface, e
 *     pode não existir com esse nome na versão dele do iOS — já perdemos a
 *     tarde com nome de ação que mudou.
 *   - Média e máximo aqui são testáveis; lá não são.
 *   - Se eu quiser mudar a conta depois (descartar FC abaixo do repouso, por
 *     exemplo), mudo no servidor e não peço pra ninguém remontar atalho.
 *
 * A duração vem do intervalo, não de um campo: início veio de
 * `/api/relogio/inicio`, fim é agora.
 */
export const runtime = "nodejs";

const corpoSchema = z.object({
  /**
   * Opcional. Se vier, manda. Se não vier, a janela é DESCOBERTA pela
   * densidade das amostras de FC — ver lib/cardio/janela.ts. É o que permite
   * uma automação só, sem precisar avisar o começo do treino.
   */
  inicio_em: z.string().trim().min(10).optional(),
  /** Opcional: sem ele, agora. Uma ação a menos no Atalho. */
  fim_em: z.string().trim().min(10).optional(),
  /** "78,82,91,105" — como o "Combinar Texto" do Atalhos entrega. */
  fc: z.string().max(400_000).optional(),
  kcal: z.string().max(400_000).optional(),
  /** Horários das amostras acima, na MESMA ordem. Com eles a janela é achada
   *  sozinha; sem eles, vale tudo o que veio. */
  fc_datas: z.string().max(400_000).optional(),
  kcal_datas: z.string().max(400_000).optional(),
  /** Sem tipo, "outro" — e aí quem decide é o horário (D-017). */
  tipo: z.string().trim().max(120).optional(),
  distancia_km: z.coerce.number().min(0).max(500).nullish(),
});

/**
 * Converte "78, 82, 91" numa lista de números.
 *
 * Tolerante por necessidade: o Atalhos entrega número com vírgula decimal em
 * aparelho em português ("1,5"), e separa itens por vírgula também. Por isso a
 * quebra é por vírgula, nova linha OU espaço, e o que sobrar vira número —
 * "1,5" acaba virando 1 e 5, o que para FC e caloria em kcal é irrelevante
 * (são inteiros na prática) e é melhor que descartar a amostra.
 */
function numeros(texto: string | undefined): number[] {
  if (!texto) return [];
  return texto
    .split(/[,\n;\s]+/)
    .map((p) => Number(p.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Quebra a lista de datas que veio do "Combinar Texto".
 *
 * NÃO dá pra quebrar por vírgula cegamente: a data em pt-BR tem vírgula
 * dentro dela ("12/09/2026, 15:00:56"). Por isso a quebra é por nova linha, e
 * só cai pra vírgula quando não há nenhuma quebra de linha — e, mesmo aí, só
 * numa vírgula seguida de dd/.
 */
function datas(texto: string | undefined): string[] {
  if (!texto) return [];
  const cru = texto.includes("\n")
    ? texto.split("\n")
    : texto.split(/,(?=\s*\d{2}\/)/);
  return cru.map((p) => p.trim()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  if (!tokenConfere(request.headers.get("authorization"))) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    return NextResponse.json({ erro: "corpo não é JSON" }, { status: 400 });
  }

  const parsed = corpoSchema.safeParse(bruto);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "dados inválidos", detalhe: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }
  const c = parsed.data;

  // ── a janela do treino ──────────────────────────────────────────────────
  // Três fontes, nesta ordem: as datas das amostras (achada por densidade), o
  // `inicio_em` mandado à mão, ou nada — e aí não dá pra registrar.
  const paresFc = parear(
    numeros(c.fc).filter((n) => n >= 30 && n <= 240),
    datas(c.fc_datas),
  );
  const janela = paresFc.length ? janelaDoTreino(paresFc) : null;

  const inicio = janela?.inicio ?? (c.inicio_em ? lerData(c.inicio_em) : null);
  const fim = janela?.fim ?? (c.fim_em ? lerData(c.fim_em) : new Date());

  if (!inicio || !fim) {
    return NextResponse.json(
      { erro: "não consegui descobrir a janela do treino", amostras_fc: paresFc.length },
      { status: 400 },
    );
  }
  if (fim <= inicio) {
    return NextResponse.json({ erro: "fim antes do início" }, { status: 400 });
  }

  const duracaoMin = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 60_000));
  if (duracaoMin > 600) {
    return NextResponse.json({ erro: "intervalo maior que 10 horas" }, { status: 400 });
  }

  // Só a FC DA JANELA entra na média. Sem isto, a batida de repouso das horas
  // anteriores — que veio no mesmo pacote — puxaria a média pra baixo.
  const fcs = (janela?.amostras.map((a) => a.valor) ??
    numeros(c.fc).filter((n) => n >= 30 && n <= 240));
  const fcMedia = fcs.length ? Math.round(fcs.reduce((a, b) => a + b, 0) / fcs.length) : null;
  const fcMax = fcs.length ? Math.max(...fcs) : null;

  // Energia ativa vem em muitas amostras pequenas; o que interessa é a soma
  // DENTRO da janela — recortada pelos horários, quando eles vieram.
  const paresKcal = parear(numeros(c.kcal), datas(c.kcal_datas));
  const kcals = paresKcal.length
    ? paresKcal
        .filter((a) => a.em >= inicio && a.em <= fim)
        .map((a) => a.valor)
    : numeros(c.kcal);
  const calorias = kcals.length ? Math.round(kcals.reduce((a, b) => a + b, 0)) : null;

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: usuarios } = await db.auth.admin.listUsers();
  const userId = usuarios?.users[0]?.id;
  if (!userId) return NextResponse.json({ erro: "nenhum usuário" }, { status: 500 });

  const resultado = await processarTreino(db, userId, {
    // O instante de início é chave natural: o mesmo treino reenviado não
    // duplica, e dois treinos diferentes nunca começam no mesmo segundo.
    origem_id: `relogio-${inicio.toISOString()}`,
    tipo: c.tipo ?? "outro",
    inicio,
    duracaoMin,
    calorias,
    distancia_km: c.distancia_km ?? null,
    fc_media: fcMedia,
    fc_max: fcMax,
  });

  if (!resultado.ok) {
    return NextResponse.json({ erro: resultado.erro }, { status: resultado.status });
  }

  return NextResponse.json({
    ...resultado,
    duracao_min: duracaoMin,
    inicio_em: inicio.toISOString(),
    janela_por: janela ? "densidade das amostras" : "inicio_em informado",
    amostras_fc: fcs.length,
    fc_media: fcMedia,
    fc_max: fcMax,
    calorias,
  });
}
