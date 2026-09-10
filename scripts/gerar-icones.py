"""
Gera os ícones do PWA. Rodar: python scripts/gerar-icones.py

Desenha em 2048px e reduz com LANCZOS — reduzir vetor grande fica muito melhor
que desenhar pequeno. Pra trocar o ícone, edite AQUI e rode de novo; os
arquivos em public/ são sobrescritos.

Desenho: uma barra (halter) em ciano sobre o fundo do app.
"""
from PIL import Image, ImageDraw

FUNDO = (10, 10, 11)
CIANO = (34, 211, 238)
G = 2048


def desenhar(mascaravel: bool) -> Image.Image:
    img = Image.new("RGB", (G, G), FUNDO)
    d = ImageDraw.Draw(img)
    # Ícone mascarável precisa caber na "safe zone" (círculo de 80%): o Android
    # recorta as bordas. Por isso o desenho encolhe.
    e = 0.62 if mascaravel else 0.78
    cx = cy = G / 2
    meia_barra = G * e / 2
    esp = G * 0.055          # espessura da barra
    anilha_alt = G * e * 0.62
    anilha_larg = G * 0.085

    # barra central
    d.rounded_rectangle(
        [cx - meia_barra, cy - esp / 2, cx + meia_barra, cy + esp / 2],
        radius=esp / 2, fill=CIANO,
    )
    # duas anilhas de cada lado, a de fora menor
    for lado in (-1, 1):
        for i, (dist, fator) in enumerate(((0.60, 1.0), (0.82, 0.66))):
            x = cx + lado * meia_barra * dist
            h = anilha_alt * fator
            d.rounded_rectangle(
                [x - anilha_larg / 2, cy - h / 2, x + anilha_larg / 2, cy + h / 2],
                radius=anilha_larg / 3, fill=CIANO,
            )
    return img


base = desenhar(False)
mascara = desenhar(True)

saidas = [
    ("public/icon-192.png", base, 192),
    ("public/icon-512.png", base, 512),
    ("public/icon-512-maskable.png", mascara, 512),
    # iOS usa esta pra tela de início e NÃO aplica cantos arredondados sozinho
    # em cima de transparência — por isso o fundo é opaco.
    ("public/apple-touch-icon.png", base, 180),
]
for caminho, origem, tam in saidas:
    origem.resize((tam, tam), Image.LANCZOS).save(caminho, "PNG")
    print(f"  {caminho}  {tam}x{tam}")
