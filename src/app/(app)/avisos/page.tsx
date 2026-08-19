import { TelaAvisos } from './TelaAvisos';

/**
 * Avisos do Telão.
 *
 * Diferente da Ordem do Culto, não são duas telas de modo exclusivo — o
 * líder cadastra E publica, na mesma tela; o operador só publica. A
 * diferença de papel aparece como um bloco a mais ou a menos, não como uma
 * tela inteira diferente.
 */
export default function PaginaAvisos() {
  return <TelaAvisos />;
}
