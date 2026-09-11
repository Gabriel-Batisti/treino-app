import { FormFoto } from "./form-foto";

/**
 * Fora do grupo `(tabs)` porque é tarefa com começo e fim. A rota é
 * `/foto-nova` e não `/fotos/nova` de propósito: `/fotos` já existe dentro do
 * grupo, e ter o mesmo segmento nos dois lugares confunde a resolução de rota.
 */
export default function NovaFoto() {
  return <FormFoto />;
}
