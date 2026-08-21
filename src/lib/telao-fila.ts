/**
 * A fila de comandos para o telão — o caminho que funciona com o Coredja
 * hospedado na internet.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O PROBLEMA
 * ────────────────────────────────────────────────────────────────────────────
 * O Holyrics roda no PC da igreja, num endereço `192.168.x.x`. Essa faixa é
 * privada por norma (RFC 1918): existe só dentro daquela rede, e milhões de
 * redes no mundo têm o mesmo número. Um servidor na internet que tentasse
 * falar com `192.168.50.103` bateria na própria rede dele, nunca na igreja.
 * Não há endereço a configurar que resolva — é assim por construção.
 *
 * Rodando na rede da igreja (o `Coredja.bat` no PC do audiovisual), o servidor
 * alcança o Holyrics direto e nada disso é necessário. Publicado, não alcança.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A SOLUÇÃO: INVERTER QUEM LIGA PARA QUEM
 * ────────────────────────────────────────────────────────────────────────────
 * Em vez de o servidor procurar o Holyrics (impossível de fora), quem procura
 * é um programa rodando DENTRO da rede da igreja — a "ponte". Ela escuta esta
 * fila no Firestore e, ao ver um comando, executa no Holyrics ali do lado.
 *
 * É o mesmo desenho do WhatsApp Web: o servidor não liga para o seu celular,
 * o celular é que mantém a linha aberta. Assim funciona atrás de qualquer
 * roteador, sem abrir porta nenhuma e sem expor o PC da igreja à internet.
 *
 *     Você clica "Projetar"  →  fila no Firestore  →  ponte  →  Holyrics
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE COMANDO, E NÃO ESTADO
 * ────────────────────────────────────────────────────────────────────────────
 * Poderia-se gravar o ESTADO desejado ("o cronômetro deve estar em 5:00") e
 * deixar a ponte reconciliar. Seria mais robusto contra ponte que caiu e
 * voltou — ela leria o estado atual e se ajustaria sozinha.
 *
 * A escolha aqui é COMANDO ("ligue o cronômetro em 5:00") porque o telão não é
 * só do Coredja: quem opera o Holyrics mexe nele à mão o tempo todo, no meio
 * do culto. Um reconciliador ficaria desfazendo essas mexidas — a pessoa muda
 * algo no Holyrics e a ponte "corrige" de volta para o que o Coredja acha que
 * devia estar. Comando faz o que foi pedido, quando foi pedido, e depois não
 * insiste.
 */

/** O que a ponte sabe executar. Um por ação de `holyrics.ts`. */
export type TipoDeComando =
  | 'cronometro-iniciar'
  | 'cronometro-parar'
  | 'cronometro-definir'
  | 'cronometro-somar'
  | 'aviso-projetar'
  | 'aviso-limpar'
  | 'aviso-fila';

/** Um comando esperando na fila. */
export interface ComandoDoTelao {
  id: string;
  tipo: TipoDeComando;
  /** Os dados da ação. O formato depende de `tipo` — ver `dadosDoComando`. */
  dados: Record<string, unknown>;
  /** ISO 8601 de quando foi enfileirado. */
  criadoEm: string;
  /**
   * Depois disto o comando não deve mais ser executado — ver `VALIDADE_MS`.
   * Guardado junto (e não calculado pela ponte) para que mudar a validade aqui
   * não mude o significado de comandos já gravados.
   */
  expiraEm: string;
  /** Nome de quem disparou, para o histórico dizer o que aconteceu e por quem. */
  porQuem?: string;
}

/**
 * Quanto tempo um comando continua valendo.
 *
 * 90 segundos é curto de propósito, e é a decisão mais importante deste
 * arquivo. Um comando de telão é sobre AGORA: "projete este aviso", "o bloco
 * começou, ligue o cronômetro em 10 minutos". Se a ponte estava desligada e
 * subiu vinte minutos depois, executar a fila acumulada seria pior que não
 * fazer nada — o telão acenderia um aviso que já passou e o cronômetro
 * mostraria um bloco que já acabou, no meio de outra coisa.
 *
 * A janela cobre o caso real (a ponte reiniciou, a rede oscilou por alguns
 * segundos) e descarta o caso perigoso (a ponte ficou fora e voltou depois).
 */
export const VALIDADE_MS = 90_000;

/** Se este comando ainda vale, comparado com o relógio de quem pergunta. */
export function comandoAindaVale(
  comando: Pick<ComandoDoTelao, 'expiraEm'>,
  agora = Date.now(),
): boolean {
  const prazo = Date.parse(comando.expiraEm);
  // Data inválida (documento corrompido ou de uma versão futura): tratar como
  // vencido é a leitura conservadora — melhor não projetar do que projetar
  // algo cuja validade não se sabe.
  return Number.isFinite(prazo) && prazo > agora;
}

/**
 * Monta os dados de cada tipo de comando, num lugar só.
 *
 * Existe para o site e a ponte não descreverem o mesmo comando de dois jeitos
 * diferentes: são dois programas separados, e um campo renomeado de um lado
 * viraria um comando ignorado do outro, em silêncio, no domingo.
 */
export const dadosDoComando = {
  cronometroIniciar: (minutos: number) => ({ minutos }),
  cronometroParar: () => ({}),
  cronometroDefinir: (segundos: number) => ({ segundos }),
  cronometroSomar: (minutos: number) => ({ minutos }),
  /**
   * `imagem`, quando presente, é a arte em data URI (`data:image/jpeg;base64,...`)
   * — o mesmo formato já usado em `aviso.imagem.url` quando embutida. Só a
   * PONTE sabe fazer algo com ela (salvar na pasta de Fotos do Holyrics): o
   * caminho direto (`entregar()` sem fila) nunca manda imagem, porque
   * `SetTextCommunicationPanel` não aceita — ver `holyrics.ts`.
   *
   * `imagemNome` vai junto para o arquivo ser gravado lá com o nome que a
   * pessoa reconhece, e não um id gerado — é por ele que quem opera acha a
   * arte na aba Fotos do Holyrics.
   *
   * `projetarImagem` decide o que acontece depois de salvar: `false` (padrão)
   * só deixa o arquivo pronto na pasta, para quem está na cabine exibir na
   * hora certa; `true` manda o Holyrics jogar no telão na mesma hora. São
   * dois usos de verdade diferentes — "já deixa a arte lá para o domingo" e
   * "põe isso no telão agora" — por isso a escolha é de quem clica, não um
   * padrão fixo.
   */
  aviso: (
    titulo: string,
    texto: string,
    imagemUrl?: string,
    imagemNome?: string,
    projetarImagem?: boolean,
  ) => ({
    titulo,
    texto,
    ...(imagemUrl ? { imagem: imagemUrl } : {}),
    ...(imagemUrl && imagemNome ? { imagemNome } : {}),
    ...(imagemUrl && projetarImagem ? { projetarImagem: true } : {}),
  }),
  avisoLimpar: () => ({}),
} as const;

/** Descrição curta do comando, para o histórico e para o log da ponte. */
export function descreverComando(comando: ComandoDoTelao): string {
  const d = comando.dados;
  switch (comando.tipo) {
    case 'cronometro-iniciar':
      return `Ligar cronômetro em ${d.minutos} min`;
    case 'cronometro-parar':
      return 'Parar cronômetro';
    case 'cronometro-definir':
      return `Ajustar cronômetro para ${d.segundos}s`;
    case 'cronometro-somar':
      return `${Number(d.minutos) < 0 ? 'Tirar' : 'Somar'} ${Math.abs(Number(d.minutos))} min do cronômetro`;
    case 'aviso-projetar':
      return `Projetar${d.imagem ? ' (com imagem)' : ''}: ${String(d.titulo || d.texto || '').slice(0, 40)}`;
    case 'aviso-limpar':
      return 'Tirar aviso do telão';
    case 'aviso-fila':
      return `Enfileirar${d.imagem ? ' (com imagem)' : ''}: ${String(d.titulo || d.texto || '').slice(0, 40)}`;
  }
}
