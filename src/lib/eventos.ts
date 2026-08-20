/**
 * Avisos em tempo real entre quem grava e quem está com a tela aberta.
 *
 * Quando um departamento envia um recado, o painel do outro lado precisa
 * mostrá-lo sem que ninguém atualize a página. O caminho é: a rota de envio
 * chama `publicar()`, e todas as telas conectadas recebem o aviso e
 * recarregam seus dados.
 *
 * O aviso carrega apenas o tipo do evento e a conversa afetada, nunca o
 * conteúdo da mensagem. Assim o painel decide o que buscar, e uma tela nunca
 * recebe dados de outra conversa por este canal.
 *
 * Isto vale enquanto o servidor é um só — o PC do audiovisual, que é o caso
 * aqui. Com Firebase, este arquivo é substituído pelos listeners do Firestore.
 */

export type TipoEvento =
  | 'mensagem-nova'
  | 'mensagem-resolvida'
  | 'mensagem-reaberta';

export interface Evento {
  tipo: TipoEvento;
  conversaId: string;
  /** Marca de tempo do evento, para depuração. */
  em: string;
}

type Ouvinte = (evento: Evento) => void;

/**
 * Os ouvintes ficam em `globalThis` porque o Next recarrega módulos em
 * desenvolvimento; sem isso, cada alteração de código criaria um conjunto novo
 * e as telas já conectadas parariam de receber avisos.
 */
function registro(): Set<Ouvinte> {
  const cache = globalThis as typeof globalThis & {
    __coredjaOuvintes?: Set<Ouvinte>;
  };
  if (!cache.__coredjaOuvintes) cache.__coredjaOuvintes = new Set();
  return cache.__coredjaOuvintes;
}

/** Registra um ouvinte e devolve a função que o remove. */
export function inscrever(ouvinte: Ouvinte): () => void {
  const ouvintes = registro();
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Avisa todas as telas conectadas de que algo mudou. */
export function publicar(tipo: TipoEvento, conversaId: string): void {
  const evento: Evento = { tipo, conversaId, em: new Date().toISOString() };
  for (const ouvinte of registro()) {
    // Uma tela que caiu no meio do envio não pode derrubar o aviso das outras.
    try {
      ouvinte(evento);
    } catch {
      // Ignorado de propósito: a limpeza acontece no fechamento da conexão.
    }
  }
}
