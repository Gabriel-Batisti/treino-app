import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Treino",
  applicationName: "Treino",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Treino",
    // "black-translucent" SÓ pode existir junto com viewportFit "cover" abaixo
    // E com o padding env(safe-area-inset-*) do globals.css. As três coisas
    // andam juntas — ver o contra-exemplo do leilões-app no CLAUDE.md.
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Trava o zoom: na academia, pinçar sem querer no meio da série atrapalha.
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0b",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
