'use client';

import { useState } from 'react';
import { CATEGORIAS_SUGERIDAS, type MensagemDaLive } from '@/lib/live';

interface Props {
  mensagem: MensagemDaLive;
  /** false para quem só copia — ver `podeEditar` em `TelaAoVivo`. */
  podeEditar: boolean;
  /** Verdadeiro nos ~2s seguintes ao clique de copiar nesta mensagem. */
  copiada: boolean;
  onCopiar: () => void;
  onAtualizar: (texto: string, categoria: string) => Promise<void>;
  onRemover: () => Promise<void>;
}

/**
 * Uma mensagem pronta na lista.
 *
 * O cartão INTEIRO é o botão de copiar — ao vivo, mirar num botãozinho de
 * "copiar" no canto custa tempo e erra. Editar e apagar ficam em botões
 * próprios, irmãos do botão de copiar e não filhos dele: um botão dentro de
 * outro botão é HTML inválido, e `stopPropagation` num clique aninhado
 * resolveria o clique mas não o teclado (Enter no botão de dentro ainda
 * dispararia os dois). Irmãos numa linha `flex` evitam os dois problemas.
 */
export function CartaoDaMensagem({
  mensagem,
  podeEditar,
  copiada,
  onCopiar,
  onAtualizar,
  onRemover,
}: Props) {
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [texto, setTexto] = useState(mensagem.texto);
  const [categoria, setCategoria] = useState(mensagem.categoria);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    await onAtualizar(texto.trim(), categoria.trim());
    setSalvando(false);
    setEditando(false);
  }

  return (
    <li
      className="rounded-xl border transition-colors"
      style={{
        borderColor: copiada ? 'var(--sucesso)' : 'var(--borda)',
        background: 'var(--fundo-cartao)',
      }}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onCopiar}
          // O `aria-label` diz o que o clique FAZ; o texto visível fica no
          // corpo do botão para quem lê a tela com os olhos.
          aria-label={`Copiar: ${mensagem.texto}`}
          className="flex min-h-[56px] min-w-0 flex-1 flex-col justify-center gap-1 rounded-l-xl px-4 py-3 text-left hover:bg-fundo-elevado"
        >
          <span className="text-sm text-texto">{mensagem.texto}</span>
          <span className="flex items-center gap-2 text-xs">
            {copiada ? (
              <span className="font-semibold" style={{ color: 'var(--sucesso)' }}>
                Copiado!
              </span>
            ) : (
              <span className="text-texto-fraco">Toque para copiar</span>
            )}
            {mensagem.vezesCopiada > 0 && (
              <span className="text-texto-fraco">
                · {mensagem.vezesCopiada}{' '}
                {mensagem.vezesCopiada === 1 ? 'cópia' : 'cópias'}
              </span>
            )}
          </span>
        </button>

        {podeEditar && (
          <div className="flex shrink-0 items-center gap-1 border-l border-borda px-2">
            <button
              type="button"
              onClick={() => {
                setConfirmando(false);
                setEditando((v) => !v);
              }}
              aria-label={editando ? 'Fechar edição' : 'Editar mensagem'}
              aria-expanded={editando}
              className="h-11 min-w-11 rounded-lg px-2 text-sm text-texto-fraco hover:bg-fundo-elevado hover:text-texto"
            >
              {editando ? 'Fechar' : 'Editar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                setConfirmando(true);
              }}
              aria-label="Apagar mensagem"
              className="h-11 w-11 rounded-lg text-texto-fraco hover:bg-fundo-elevado hover:text-texto"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {confirmando && (
        <div className="flex flex-col gap-3 border-t border-borda px-4 py-3 sm:flex-row sm:items-center">
          <p className="text-sm text-texto-suave">Apagar esta mensagem?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                setConfirmando(false);
                await onRemover();
              }}
              className="h-11 rounded-lg px-4 text-sm font-semibold"
              style={{ background: 'var(--urgente)', color: 'var(--fundo-cartao)' }}
            >
              Apagar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="h-11 rounded-lg border border-borda px-4 text-sm text-texto-suave hover:text-texto"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {editando && (
        <div className="flex flex-col gap-3 border-t border-borda px-4 py-3">
          <div>
            <label
              htmlFor={`texto-${mensagem.id}`}
              className="mb-1.5 block text-sm text-texto-suave"
            >
              Mensagem
            </label>
            <textarea
              id={`texto-${mensagem.id}`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto"
            />
          </div>

          <div>
            <label
              htmlFor={`categoria-${mensagem.id}`}
              className="mb-1.5 block text-sm text-texto-suave"
            >
              Categoria
            </label>
            <input
              id={`categoria-${mensagem.id}`}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              list="categorias-sugeridas"
              placeholder="Sem categoria"
              className="w-full rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto placeholder:text-texto-fraco"
            />
          </div>

          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !texto.trim()}
            className="h-11 self-start rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * As sugestões de categoria, num `<datalist>` só para a página inteira.
 *
 * Cada `CartaoDaMensagem` aponta para ele por `list=`, em vez de cada um
 * carregar a própria cópia: com vinte mensagens na tela seriam vinte listas
 * idênticas no HTML.
 */
export function SugestoesDeCategoria({ existentes }: { existentes: string[] }) {
  // As categorias que a igreja já usa vêm primeiro — são as que de fato
  // interessam. As sugestões do código só completam o que ainda não existe.
  const lista = [
    ...existentes,
    ...CATEGORIAS_SUGERIDAS.filter((sugestao) => !existentes.includes(sugestao)),
  ];

  return (
    <datalist id="categorias-sugeridas">
      {lista.map((categoria) => (
        <option key={categoria} value={categoria} />
      ))}
    </datalist>
  );
}
