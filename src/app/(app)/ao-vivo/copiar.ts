/**
 * Copiar texto para a área de transferência, com o motivo em português
 * quando não dá.
 *
 * `navigator.clipboard` só existe em contexto seguro (HTTPS ou localhost) e
 * pode ser negada pelo navegador. Numa tela usada ao vivo, o pior desfecho é
 * o clique não fazer nada e a pessoa colar o texto anterior sem perceber —
 * então toda falha vira uma frase que diz o que fazer, nunca silêncio.
 */

export type ResultadoDaCopia = { ok: true } | { ok: false; motivo: string };

export async function copiarTexto(texto: string): Promise<ResultadoDaCopia> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return {
      ok: false,
      motivo:
        'Este navegador não libera a área de transferência aqui. ' +
        'Abra o Coredja por um endereço https:// e tente de novo, ou selecione o texto e copie à mão.',
    };
  }

  try {
    await navigator.clipboard.writeText(texto);
    return { ok: true };
  } catch {
    // Cai aqui quando a permissão foi negada, ou quando o clique não conta
    // como "gesto do usuário" para o navegador.
    return {
      ok: false,
      motivo:
        'O navegador bloqueou a cópia. Libere o acesso à área de transferência ' +
        'nas permissões do site, ou selecione o texto e copie à mão.',
    };
  }
}
