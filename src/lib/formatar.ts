/** Formatação de datas e tamanhos para exibição nas telas. */

/** Hora no formato 14:32, que é o que interessa durante um culto. */
export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Data e hora completas, para o histórico de dias anteriores. */
export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Há quanto tempo o recado chegou, em texto curto.
 *
 * No painel isto importa mais que o horário absoluto: "há 12 min" diz
 * na hora se alguém está esperando resposta faz tempo.
 */
export function tempoDecorrido(iso: string, agora: number = Date.now()): string {
  const segundos = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 1000));

  if (segundos < 60) return 'agora';
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

/** Tamanho de arquivo legível. */
export function tamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
