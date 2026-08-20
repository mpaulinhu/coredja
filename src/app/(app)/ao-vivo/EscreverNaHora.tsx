'use client';

import { useRef, useState } from 'react';
import { problemaNaMensagem, TAMANHO_MAXIMO_TEXTO } from '@/lib/live';

interface Props {
  /** Copia e devolve se deu certo — o motivo da falha vira recado na tela. */
  onCopiar: (texto: string) => Promise<boolean>;
  /**
   * Guardar o que foi escrito como mensagem fixa. `undefined` para quem não
   * tem `live:escrever` — sem permissão o botão nem aparece, em vez de
   * aparecer e devolver 403 no meio da live.
   */
  onSalvar?: (texto: string, categoria: string) => Promise<{ ok: boolean }>;
}

/** Quanto tempo o "Copiado!" fica na tela antes de sumir sozinho. */
const DURACAO_DO_AVISO_MS = 2000;

/**
 * Escrever na hora: a caixa para o texto que não estava previsto.
 *
 * É o primeiro bloco da tela de propósito. A biblioteca cobre o que se
 * repete todo domingo; isto cobre o resto — "o culto começa em 5 minutos",
 * "o link do formulário é este" — sem obrigar ninguém a cadastrar algo que
 * vai usar uma vez só.
 *
 * "Guardar como fixa" fica ao lado de "Copiar", e não numa tela separada,
 * porque é exatamente aqui que se descobre que um texto avulso virou hábito:
 * na terceira vez que a pessoa digita a mesma frase.
 */
export function EscreverNaHora({ onCopiar, onSalvar }: Props) {
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpo = texto.trim();
  const excedeu = limpo.length > TAMANHO_MAXIMO_TEXTO;

  function avisarCopiado() {
    setCopiado(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(false), DURACAO_DO_AVISO_MS);
  }

  async function copiar() {
    if (!limpo) return;
    setProblema(null);
    const deuCerto = await onCopiar(limpo);
    if (deuCerto) avisarCopiado();
  }

  async function guardar() {
    if (!onSalvar) return;
    const impedimento = problemaNaMensagem(texto);
    if (impedimento) {
      setProblema(impedimento);
      return;
    }

    setProblema(null);
    setGuardando(true);
    const resultado = await onSalvar(limpo, categoria.trim());
    setGuardando(false);

    // O texto só some do campo quando de fato virou mensagem fixa — se a
    // gravação falhou, apagá-lo perderia o que a pessoa acabou de escrever.
    if (resultado.ok) {
      setTexto('');
      setCategoria('');
    }
  }

  return (
    <div className="rounded-2xl border border-borda bg-fundo-elevado p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-texto-suave">Escrever na hora</h2>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Digite e copie, sem cadastrar nada."
        rows={2}
        aria-label="Mensagem para copiar agora"
        className="mt-2 w-full resize-none rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto placeholder:text-texto-fraco"
      />

      {excedeu && (
        <p className="mt-1 text-xs" style={{ color: 'var(--urgente)' }}>
          {limpo.length} de {TAMANHO_MAXIMO_TEXTO} caracteres.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copiar}
          disabled={!limpo}
          className="h-11 flex-1 rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{
            background: copiado ? 'var(--sucesso)' : 'var(--acento)',
            color: copiado ? 'var(--fundo-cartao)' : 'var(--acento-texto)',
          }}
        >
          {copiado ? 'Copiado!' : 'Copiar'}
        </button>

        {onSalvar && (
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !limpo}
            className="h-11 shrink-0 rounded-lg border border-borda-forte px-4 text-sm font-semibold text-texto disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar como fixa'}
          </button>
        )}
      </div>

      {/* A categoria só faz sentido para quem pode guardar — para os demais
          seria um campo que não leva a lugar nenhum. */}
      {onSalvar && (
        <input
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          list="categorias-sugeridas"
          placeholder="Categoria ao guardar (opcional)"
          aria-label="Categoria da mensagem ao guardar"
          className="mt-2 w-full rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto placeholder:text-texto-fraco"
        />
      )}

      {problema && (
        <p role="alert" className="mt-2 text-sm" style={{ color: 'var(--urgente)' }}>
          {problema}
        </p>
      )}
    </div>
  );
}
