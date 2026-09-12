"""
Baixa as ilustrações dos exercícios e gera lib/treino/ilustracoes.ts.

    python scripts/baixar-ilustracoes.py

FONTE: yuhonas/free-exercise-db — 876 exercícios, licença Unlicense (domínio
público). Cada um tem DUAS fotos: início e fim do movimento. Alternando as duas
num loop, lê como a animação de um app pago. Animação de verdade só existe em
base proprietária.

O mapa MORA AQUI, não no banco: é estático, são 48 linhas, e assim não exige
migration nem round-trip — e o service worker cacheia os arquivos junto com o
resto do app.

`aprox=True` quando o movimento é o mesmo mas o aparelho não (halter no lugar de
polia, por exemplo). A UI avisa. Melhor uma foto aproximada e rotulada do que
nenhuma, e MUITO melhor que uma foto errada sem aviso.

Chave = `nome_busca` (nome normalizado, minúsculo sem acento — a mesma função
de lib/treino/texto.ts).
"""
import io
import json
import unicodedata
import urllib.request
from pathlib import Path

from PIL import Image

RAW = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"
JSON_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
SAIDA_IMG = Path("public/ex")
SAIDA_TS = Path("lib/treino/ilustracoes.ts")
LARGURA = 420

# nome do exercício do usuário -> (nome na free-exercise-db, é aproximação?)
MAPA = {
    "Abdominal Declinado": ("Decline Crunch", False),
    "Cadeira Extensora (Máquina)": ("Leg Extensions", False),
    "Crucifixo (Máquina)": ("Butterfly", False),
    "Tríceps na Polia": ("Triceps Pushdown", False),
    "Extensão de Panturrilha (Máquina)": ("Calf Press", False),
    "Puxada Alta (Cabo)": ("Wide-Grip Lat Pulldown", False),
    "Elevação Lateral (Halter)": ("Side Lateral Raise", False),
    "Mesa Flexora (Máquina)": ("Lying Leg Curls", False),
    "Crossover na Polia": ("Cable Crossover", False),
    "Puxada Alta - Pegada Fechada (Cabo)": ("Close-Grip Front Lat Pulldown", False),
    "Tríceps Corda (Polia)": ("Triceps Pushdown - Rope Attachment", False),
    "Cadeira Flexora (Máquina)": ("Seated Leg Curl", False),
    "Crucifixo Invertido (Máquina)": ("Reverse Machine Flyes", False),
    "Abdominal (Máquina)": ("Ab Crunch Machine", False),
    "Supino Inclinado (Halter)": ("Incline Dumbbell Press", False),
    "Rosca Direta (Halter)": ("Dumbbell Bicep Curl", False),
    # halter no lugar da polia: mesmo movimento, aparelho diferente
    "Elevação Lateral Unilateral (Cabo)": ("One-Arm Side Laterals", True),
    "Elevação Frontal (Halter)": ("Front Dumbbell Raise", False),
    "Rosca Scott (Barra)": ("Preacher Curl", False),
    # barra EZ no lugar do halter
    "Tríceps Testa (Halter)": ("EZ-Bar Skullcrusher", True),
    "Supino Reto (Barra)": ("Barbell Bench Press - Medium Grip", False),
    "Remada Baixa Triangulo": ("Seated Cable Rows", False),
    "Remada Unilateral (Halter)": ("One-Arm Dumbbell Row", False),
    "Extensão Lombar (Hiperextensão com Peso)": ("Hyperextensions (Back Extensions)", False),
    "Desenvolvimento (Halter)": ("Dumbbell Shoulder Press", False),
    "Leg Press 45º (Máquina)": ("Leg Press", False),
    "Levantamento Terra (Barra)": ("Barbell Deadlift", False),
    "Remada Sentada Pegada Aberta (Cabo)": ("Seated Cable Rows", False),
    "Elevação Pélvica (Barra)": ("Barbell Hip Thrust", False),
    "Agachamento (Barra)": ("Barbell Full Squat", False),
    "Agachamento (Smith)": ("Smith Machine Squat", False),
    "Rosca Direta (Máquina)": ("Machine Bicep Curl", False),
    # landmine row é o mesmo padrão do meadows
    "Remada Meadows (Barra)": ("Bent Over One-Arm Long Bar Row", True),
    "Desenvolvimento Maquina": ("Machine Shoulder (Military) Press", False),
    "Remada Iso-Lateral (Máquina)": ("Leverage Iso Row", False),
    "Supino Inclinado (Máquina)": ("Leverage Incline Chest Press", False),
    "Cadeira Abdutora (Máquina)": ("Thigh Abductor", False),
    "Rosca Direta (Cabo)": ("Standing Biceps Cable Curl", False),
    "Supino Articulado Deitado": ("Leverage Chest Press", False),
    "Supino Sentado (Máquina)": ("Leverage Chest Press", False),
    "Desenvolvimento Militar (Barra)": ("Standing Military Press", False),
    "Supino Inclinado (Máquina Smith)": ("Smith Machine Incline Bench Press", False),
    "Tríceps Francês (Polia)": ("Cable Rope Overhead Triceps Extension", False),
    "Rosca Inclinada Sentado (Halter)": ("Incline Dumbbell Curl", False),
    "Cadeira Adutora (Máquina)": ("Thigh Adductor", False),
    "Remada Sentada (Máquina)": ("Leverage High Row", False),
    "Stiff (Barra)": ("Stiff-Legged Barbell Deadlift", False),
    # SEM PAR na base: "Remada Unilateral (Cabo)" — remada unilateral na polia
    # não existe lá, e as candidatas são movimentos diferentes. Fica sem imagem
    # em vez de mostrar a errada.
}


def normalizar(nome: str) -> str:
    """Espelha normalizarNome() de lib/treino/texto.ts."""
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFD", nome) if unicodedata.category(c) != "Mn"
    )
    return " ".join(sem_acento.lower().split())


def main() -> None:
    print("baixando catálogo…")
    base = json.loads(urllib.request.urlopen(JSON_URL).read().decode("utf-8"))
    por_nome = {e["name"]: e for e in base}

    SAIDA_IMG.mkdir(parents=True, exist_ok=True)
    entradas = []
    faltando = []

    for meu, (deles, aprox) in sorted(MAPA.items()):
        alvo = por_nome.get(deles)
        if not alvo or len(alvo.get("images", [])) < 2:
            faltando.append(f"{meu} -> {deles}")
            continue

        pasta = alvo["images"][0].split("/")[0]
        destino = SAIDA_IMG / pasta
        destino.mkdir(exist_ok=True)

        for i in (0, 1):
            arquivo = destino / f"{i}.webp"
            if arquivo.exists():
                continue
            bruto = urllib.request.urlopen(RAW + alvo["images"][i]).read()
            img = Image.open(io.BytesIO(bruto)).convert("RGB")
            altura = round(img.height * LARGURA / img.width)
            img.resize((LARGURA, altura), Image.LANCZOS).save(arquivo, "WEBP", quality=78)

        entradas.append(
            {
                "chave": normalizar(meu),
                "pasta": pasta,
                "aprox": aprox,
                "fonte": deles,
                "instrucoes": alvo.get("instructions", []),
                # Metadado que alimenta a sugestão de substituto. Vinha junto
                # desde sempre e era jogado fora.
                "musculos": alvo.get("primaryMuscles", []),
                "secundarios": alvo.get("secondaryMuscles", []),
                "equipamento": alvo.get("equipment") or None,
                "forca": alvo.get("force") or None,
                "mecanica": alvo.get("mechanic") or None,
            }
        )
        print(f"  ✓ {meu}" + ("  (aproximada)" if aprox else ""))

    for f in faltando:
        print(f"  ✗ {f}")

    linhas = [
        "/**",
        " * Ilustrações dos exercícios — GERADO por scripts/baixar-ilustracoes.py.",
        " * Não editar à mão: edite o MAPA do script e rode de novo.",
        " *",
        " * Fonte: yuhonas/free-exercise-db (Unlicense, domínio público). Duas fotos",
        " * por exercício — início e fim do movimento. A UI alterna as duas.",
        " *",
        " * `aprox` = mesmo movimento, aparelho diferente. A UI rotula.",
        " * `instrucoes` vêm da base, em INGLÊS — não foram traduzidas.",
        " *",
        " * `musculos`, `equipamento`, `forca` e `mecanica` alimentam a sugestão",
        " * de substituto (lib/treino/substituir.ts). ATENÇÃO: quando `aprox` é",
        " * true, o `equipamento` é o do exercício da BASE, não o seu — por isso",
        " * o nome do seu exercício manda na hora de decidir o aparelho.",
        " */",
        "",
        "export interface Ilustracao {",
        "  /** Pasta em public/ex/ com 0.webp (início) e 1.webp (fim). */",
        "  pasta: string;",
        "  /** Movimento igual, aparelho diferente — a UI avisa. */",
        "  aprox: boolean;",
        "  /** Nome na base de origem, pra rastrear de onde veio. */",
        "  fonte: string;",
        "  instrucoes: string[];",
        "  /** Músculo(s) principal(is) — em inglês, como vem da base. */",
        "  musculos: string[];",
        "  secundarios: string[];",
        "  /** Não confie quando `aprox` for true — ver cabeçalho. */",
        "  equipamento: string | null;",
        "  /** push | pull | static */",
        "  forca: string | null;",
        "  /** compound | isolation */",
        "  mecanica: string | null;",
        "}",
        "",
        "/** Chave = `nome_busca` (ver lib/treino/texto.ts). */",
        "export const ILUSTRACOES: Record<string, Ilustracao> = {",
    ]
    for e in sorted(entradas, key=lambda x: x["chave"]):
        instr = ", ".join(json.dumps(i, ensure_ascii=False) for i in e["instrucoes"])
        j = lambda v: json.dumps(v, ensure_ascii=False)
        linhas.append(
            f'  {j(e["chave"])}: {{ pasta: {j(e["pasta"])}, '
            f'aprox: {str(e["aprox"]).lower()}, fonte: {j(e["fonte"])}, '
            f'musculos: {j(e["musculos"])}, secundarios: {j(e["secundarios"])}, '
            f'equipamento: {j(e["equipamento"])}, forca: {j(e["forca"])}, '
            f'mecanica: {j(e["mecanica"])}, instrucoes: [{instr}] }},'
        )
    linhas += [
        "};",
        "",
        "export function ilustracaoDe(nomeBusca: string): Ilustracao | null {",
        "  return ILUSTRACOES[nomeBusca] ?? null;",
        "}",
        "",
    ]
    SAIDA_TS.write_text("\n".join(linhas), encoding="utf-8")

    total_kb = sum(f.stat().st_size for f in SAIDA_IMG.rglob("*.webp")) / 1024
    print(f"\n{len(entradas)} ilustrações · {len(faltando)} sem par · {total_kb:.0f} KB em public/ex/")
    print(f"gerado: {SAIDA_TS}")


if __name__ == "__main__":
    main()
