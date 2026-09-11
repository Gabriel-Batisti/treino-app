/**
 * Redução de imagem no navegador, antes do upload.
 *
 * Por que reduzir: foto de iPhone tem 3-5 MB. Uma galeria de acompanhamento com
 * dezenas delas ficaria lenta pra abrir e comeria o 1 GB do plano gratuito em
 * poucos meses. A 1400px o suficiente pra comparar dois meses lado a lado, e
 * cada arquivo cai pra ~250 KB.
 *
 * `imageOrientation: "from-image"` NÃO é detalhe: sem isso a foto do iPhone
 * sobe deitada, porque a rotação vive no EXIF e o canvas ignora. Converter pra
 * JPEG também resolve o HEIC — que o Safari abre e o resto do mundo não.
 */

export interface ImagemReduzida {
  blob: Blob;
  largura: number;
  altura: number;
}

export async function reduzirImagem(
  arquivo: File,
  maiorLado = 1400,
  qualidade = 0.85,
): Promise<ImagemReduzida> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });

  const escala = Math.min(1, maiorLado / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("não foi possível processar a imagem");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", qualidade),
  );
  if (!blob) throw new Error("não foi possível processar a imagem");

  return { blob, largura, altura };
}
