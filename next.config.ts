import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // O laudo da bioimpedância vai inteiro pra `lerExame` ler os números.
      // O padrão de 1 MB derruba PDF de clínica com foto embutida.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
