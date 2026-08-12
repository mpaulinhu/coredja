import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coredja',
  description: 'Comunicação interna da igreja',
};

export const viewport: Viewport = {
  themeColor: '#0e1116',
  // A tela de envio precisa caber na área visível do celular mesmo com o
  // teclado aberto, e sem o recorte da câmera cobrindo conteúdo.
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
