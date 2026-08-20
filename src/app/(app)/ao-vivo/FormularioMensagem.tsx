'use client';

import { useState } from 'react';
import { problemaNaMensagem, TAMANHO_MAXIMO_TEXTO } from '@/lib/live';

interface Props {
  onCriar: (texto: string, categoria: string) => Promise<{ ok: boolean }>;
}

/**
 * Cadastro de mensagem fixa — só aparece para quem tem `live:escrever`.
 *
 * Começa recolhido, atrás de um botão. Ao vivo, a tela é a lista; um
 * formulário aberto no topo empurraria as mensagens para baixo justo quando
 * a pressa é maior, e cadastrar é trabalho de véspera, não de domingo.
 */
export function FormularioMensagem({ onCriar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);

  const limpo = texto.trim();

  async function salvar() {
    const impedimento = problemaNaMensagem(texto);
    if (impedimento) {
      setProblema(impedimento);
      return;
    }

    setProblema(null);
    setSalvando(true);
    const resultado = await onCriar(limpo, categoria.trim());
    setSalvando(false);

    if (resultado.ok) {
      setTexto('');
      // A categoria FICA: cadastrar cinco mensagens de "Ofertas" seguidas é
      // o caso comum, e redigitar o rótulo a cada uma é atrito à toa.
      setProblema(null);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="h-11 self-start rounded-lg border border-borda px-4 text-sm font-medium text-texto-suave hover:text-texto"
      >
        + Cadastrar mensagem fixa
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-borda bg-fundo-elevado p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-texto-suave">Nova mensagem fixa</h2>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="h-11 rounded-lg px-3 text-sm text-texto-fraco hover:text-texto"
        >
          Fechar
        </button>
      </div>

      <div className="mt-1 flex flex-col gap-2">
        <div>
          <label htmlFor="nova-mensagem-live" className="sr-only">
            Texto da mensagem
          </label>
          <textarea
            id="nova-mensagem-live"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex: Seja bem-vindo! Deixe seu like e compartilhe com um amigo."
            rows={3}
            className="w-full resize-none rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto placeholder:text-texto-fraco"
          />
          <p className="mt-1 text-xs text-texto-fraco">
            {limpo.length} de {TAMANHO_MAXIMO_TEXTO} caracteres.
          </p>
        </div>

        <div>
          <label htmlFor="nova-categoria-live" className="sr-only">
            Categoria
          </label>
          <input
            id="nova-categoria-live"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            list="categorias-sugeridas"
            placeholder="Categoria (ex: Abertura, Ofertas)"
            className="w-full rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto placeholder:text-texto-fraco"
          />
          <p className="mt-1 text-xs text-texto-fraco">
            Escreva o que quiser — a lista se agrupa sozinha pelo que for digitado.
          </p>
        </div>

        {problema && (
          <p role="alert" className="text-sm" style={{ color: 'var(--urgente)' }}>
            {problema}
          </p>
        )}

        <button
          type="button"
          onClick={salvar}
          disabled={salvando || !limpo}
          className="h-11 rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
        >
          {salvando ? 'Salvando…' : 'Cadastrar mensagem'}
        </button>
      </div>
    </div>
  );
}
