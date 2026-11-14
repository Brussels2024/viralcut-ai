import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ViralCut AI — Seus melhores momentos, automaticamente",
  description:
    "Transforme vídeos e transmissões em cortes verticais prontos para publicar com inteligência artificial.",
  applicationName: "ViralCut AI"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}