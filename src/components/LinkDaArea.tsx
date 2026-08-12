'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';

/**
 * Uma área na home, com o link completo e um botão de copiar.
 *
 * O endereço completo (com o `http://192.168...` ou o domínio da hospedagem)
 * só existe no navegador — o servidor não sabe por qual endereço foi
 * alcançado. Por isso ele é montado aqui, depois que a página carrega.
 */
/** O endereço do site não muda enquanto a página vive. */
const semMudanca = () => () => {};

export function LinkDaArea({
  nome,
  cor,
  caminho,
}: {
  nome: string;
  cor: string;
  caminho: string;
}) {
  // useSyncExternalStore é a forma certa de ler algo que só existe no
  // navegador: devolve '' na renderização do servidor e o valor real depois,
  // sem o desencontro que um useState + useEffect causaria.
  const origem = useSyncExternalStore(
    semMudanca,
    () => window.location.origin,
    () => '',
  );
  const enderecoCompleto = origem ? `${origem}${caminho}` : '';

  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enderecoCompleto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Navegador sem permissão de área de transferência: o link continua
      // visível na tela para copiar à mão.
    }
  }

  return (
    <li className="rounded-xl border border-borda bg-fundo-cartao">
      <div className="flex items-center gap-3 px-4 pt-4">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ background: cor }}
          aria-hidden="true"
        />
        <span className="font-semibold text-texto">{nome}</span>

        <Link
          href={caminho}
          className="ml-auto text-sm font-medium text-acento hover:underline"
        >
          Abrir →
        </Link>
      </div>

      <div className="flex items-center gap-2 px-4 pb-4 pt-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-fundo px-2.5 py-2 text-xs text-texto-suave">
          {enderecoCompleto || caminho}
        </code>
        <button
          type="button"
          onClick={copiar}
          disabled={!enderecoCompleto}
          className="shrink-0 rounded-lg border border-borda px-3 py-2 text-xs font-medium text-texto-suave hover:bg-borda disabled:opacity-50"
        >
          {copiado ? '✓ copiado' : 'copiar'}
        </button>
      </div>
    </li>
  );
}
