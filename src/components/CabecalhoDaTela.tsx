/**
 * Cabeçalho padrão de tela: título + instrução opcional.
 *
 * Título centralizado no topo da tela, como no Voluts: o conteúdo das telas
 * ocupa a largura inteira, e um H1 encostado na borda esquerda de um monitor
 * largo fica solto, longe do que ele nomeia. Centralizado, ele funciona como
 * cabeçalho da página toda.
 *
 * `instrucao` só deve carregar informação prática que muda o que o usuário
 * espera (ex: "isto sincroniza sozinho no domingo") — nunca uma frase que só
 * repete o óbvio do título. Por isso o estilo é discreto (tamanho de nota de
 * campo, não de subtítulo): não é uma segunda linha de destaque do H1, é uma
 * instrução funcional, no mesmo espírito do texto de contexto do Voluts.
 *
 * A instrução ganha `max-w` própria: centralizada e esticada na largura toda
 * da tela ela viraria uma linha única de ponta a ponta, difícil de ler.
 */
export function CabecalhoDaTela({
  titulo,
  instrucao,
}: {
  titulo: string;
  instrucao?: string;
}) {
  return (
    <div className="w-full text-center">
      <h1 className="text-2xl font-bold tracking-tight text-texto">{titulo}</h1>
      {instrucao && (
        <p className="mx-auto mt-1 max-w-2xl text-xs text-texto-fraco">{instrucao}</p>
      )}
    </div>
  );
}
