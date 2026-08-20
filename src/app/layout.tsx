import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coredja',
  description: 'Comunicação interna da igreja',
};

export const viewport: Viewport = {
  // Fixo em claro (o tema padrão) por simplicidade: a barra do navegador
  // mobile não teria como acompanhar a troca de tema em tempo real de
  // qualquer forma sem JS adicional nela, e o padrão é claro. Quem prefere
  // escuro já resolve isso na própria tela do app ao trocar o tema.
  themeColor: '#ffffff',
  // A tela de envio precisa caber na área visível do celular mesmo com o
  // teclado aberto, e sem o recorte da câmera cobrindo conteúdo.
  viewportFit: 'cover',
};

// Aplica o tema salvo (ou o palpite do sistema, na primeira visita) no
// `<html>` ANTES do React hidratar. Sem isso, a página sempre nasceria no
// tema claro (valor do `:root` sem atributo) por uma fração de segundo antes
// do JavaScript do cliente trocar para escuro — o "flash" de tema errado.
// Só dá para evitar com um script síncrono no <head>, porque o Next
// (App Router) renderiza o HTML inicial no servidor, que não tem acesso ao
// `localStorage` de quem está acessando.
const SCRIPT_TEMA_INICIAL = `
(function () {
  try {
    var salvo = localStorage.getItem('coredja:tema');
    var tema = salvo === 'escuro' || salvo === 'claro'
      ? salvo
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
    document.documentElement.dataset.tema = tema;
  } catch (e) {
    // localStorage bloqueado (aba privada restrita, etc.) — segue no claro.
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // `suppressHydrationWarning`: o script acima grava `data-tema` no <html>
    // antes do React hidratar, então o atributo nunca bate com o HTML que
    // veio do servidor (que não sabe a preferência de quem acessa). É a
    // divergência esperada aqui — sem isto, o React alerta no console a cada
    // carregamento. Só afeta este elemento, não os filhos.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
