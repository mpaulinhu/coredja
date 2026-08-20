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
        {/* Manrope (texto) e JetBrains Mono (números) — as duas fontes da
            tela de referência da Ordem do Culto, aplicadas ao app inteiro
            via `--font-sans`/`--font-mono` em `globals.css`.

            Por `<link>` e não `next/font`: `next/font` injeta a classe da
            fonte no elemento que a usa, e o `<html>` daqui já é gerenciado
            por um script inline (o `data-tema` acima) — misturar os dois
            geraria divergência de hidratação no mesmo elemento. O
            `preconnect` cobre o custo de handshake que o `next/font`
            eliminaria. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font --
            A regra avisa que uma fonte declarada fora de `pages/_document.js`
            carregaria só numa página. Isso vale para o Pages Router; aqui é o
            root layout do App Router, que é justamente o equivalente do
            `_document` — o <link> vale para o app inteiro. Falso positivo. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
