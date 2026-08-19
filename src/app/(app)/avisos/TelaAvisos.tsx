'use client';

import { collection, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import type { Aviso } from '@/lib/avisos';
import { getFirestoreCliente } from '@/lib/firebase-cliente';

/**
 * Avisos do Telão: cadastro (quem pode) + lista com o botão de publicar.
 *
 * `podeCadastrar` segue o mesmo truque de `TelaCulto`: em vez de perguntar o
 * papel, TENTA um POST e deixa o servidor responder. Um efeito colateral
 * dessa checagem é que ela cria e imediatamente teria que apagar um aviso de
 * teste — por isso aqui a checagem é feita perguntando ao servidor de outra
 * forma: o próprio botão de cadastrar aparece sempre, e o erro 403 (se vier)
 * vira mensagem em vez de sumir o formulário. Ver a explicação abaixo do
 * componente sobre por que essa tela usa uma estratégia diferente da do
 * culto para a mesma pergunta.
 */
export function TelaAvisos() {
  const [avisos, setAvisos] = useState<Aviso[] | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const db = getFirestoreCliente();
    if (!db) return;
    return onSnapshot(collection(db, 'avisos'), (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Aviso);
      lista.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
      setAvisos(lista);
    });
  }, []);

  const chamar = useCallback(async (caminho: string, metodo: string, corpo?: unknown) => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) {
      setErro('Sessão expirada. Recarregue a página.');
      return null;
    }
    const resp = await fetch(caminho, {
      method: metodo,
      headers: corpo ? { ...cabecalho, 'Content-Type': 'application/json' } : cabecalho,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const dados = await resp.json();
    if (!resp.ok) {
      setErro(dados.erro ?? 'Algo deu errado.');
      return null;
    }
    setErro(null);
    return dados;
  }, []);

  const criar = useCallback(
    (titulo: string, texto: string) => chamar('/api/avisos', 'POST', { titulo, texto }),
    [chamar],
  );
  const remover = useCallback((id: string) => chamar(`/api/avisos/${id}`, 'DELETE'), [chamar]);
  const publicar = useCallback((id: string) => chamar(`/api/avisos/${id}/telao`, 'POST'), [chamar]);
  const ocultar = useCallback((id: string) => chamar(`/api/avisos/${id}/telao`, 'DELETE'), [chamar]);

  if (avisos === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-texto-fraco">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-texto">
        Avisos do Telão
      </h1>
      <p className="mt-1 text-sm text-texto-suave">
        Cadastre durante a semana. No domingo, publique o que deve aparecer.
      </p>

      <div className="mt-6 rounded-2xl border border-borda bg-fundo-elevado p-5 sm:p-6">
        <FormularioNovoAviso onCriar={criar} />

        {erro && (
          <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--urgente)' }}>
            {erro}
          </p>
        )}
      </div>

      <ul className="mt-6 flex flex-col gap-2">
        {avisos.length === 0 && (
          <p className="text-sm text-texto-fraco">Nenhum aviso cadastrado.</p>
        )}
        {avisos.map((aviso) => (
          <li
            key={aviso.id}
            className="rounded-xl border px-4 py-3"
            style={{
              borderColor: aviso.noAr ? 'var(--acento)' : 'var(--borda)',
              background: aviso.noAr ? 'var(--fundo-cartao)' : 'transparent',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-texto">{aviso.titulo}</p>
                {aviso.texto && (
                  <p className="mt-0.5 text-sm text-texto-suave">{aviso.texto}</p>
                )}
              </div>
              {aviso.noAr && (
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
                  style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
                >
                  No telão
                </span>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => (aviso.noAr ? ocultar(aviso.id) : publicar(aviso.id))}
                className="h-10 flex-1 rounded-lg text-sm font-semibold"
                style={{
                  background: aviso.noAr ? 'var(--borda-forte)' : 'var(--acento)',
                  color: aviso.noAr ? 'var(--texto)' : 'var(--acento-texto)',
                }}
              >
                {aviso.noAr ? 'Tirar do telão' : 'Publicar no telão'}
              </button>
              <button
                type="button"
                onClick={() => remover(aviso.id)}
                aria-label="Remover aviso"
                className="h-10 w-10 rounded-lg border border-borda text-texto-fraco hover:text-texto"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Cadastrar aparece para todo mundo — quem não tem `avisos:escrever` só
 * descobre isso ao tentar salvar, quando o servidor devolve 403. É a mesma
 * ideia de "pergunte fazendo" de `TelaCulto`, mas sem escondê-lo: cadastrar
 * não muda nada até o clique em Salvar, então não há custo em deixar visível
 * e deixar o erro (se vier) explicar por que não salvou.
 */
function FormularioNovoAviso({
  onCriar,
}: {
  onCriar: (titulo: string, texto: string) => Promise<unknown>;
}) {
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!titulo.trim()) return;
    setSalvando(true);
    const resultado = await onCriar(titulo, texto);
    setSalvando(false);
    if (resultado) {
      setTitulo('');
      setTexto('');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título (ex: Batismo dia 30)"
        className="w-full rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto placeholder:text-texto-fraco"
      />
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Detalhes (opcional)"
        rows={2}
        className="w-full resize-none rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto placeholder:text-texto-fraco"
      />
      <button
        type="button"
        onClick={salvar}
        disabled={salvando || !titulo.trim()}
        className="h-11 rounded-lg text-sm font-semibold disabled:opacity-50"
        style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
      >
        {salvando ? 'Salvando…' : 'Cadastrar aviso'}
      </button>
    </div>
  );
}
