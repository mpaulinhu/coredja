'use client';

import { collection, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import { normalizarAviso, ordenarParaPublicar, valeNoDia, type Aviso } from '@/lib/avisos';
import { CabecalhoDaTela } from '@/components/CabecalhoDaTela';
import { comprimirImagem } from '@/lib/comprimir';
import { hojeLocal } from '@/lib/culto';
import { ImagemAnexo } from '@/components/ImagemAnexo';
import { getFirestoreCliente } from '@/lib/firebase-cliente';
import { TAMANHO_MAXIMO_BYTES } from '@/lib/limites';

/** Resposta da publicação, na parte que conta o que houve com o Holyrics. */
interface RetornoTelao {
  holyrics?: { estado: string; motivo?: string } | null;
}

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
  const [recado, setRecado] = useState<string | null>(null);
  const [holyricsLigado, setHolyricsLigado] = useState(false);

  // Calculado uma vez por montagem: recalcular a cada render faria a lista
  // reordenar sozinha na virada da meia-noite, no meio de um clique.
  const hoje = useMemo(() => hojeLocal(), []);

  useEffect(() => {
    const db = getFirestoreCliente();
    if (!db) return;
    return onSnapshot(collection(db, 'avisos'), (snap) => {
      const lista = snap.docs.map((d) => normalizarAviso({ id: d.id, ...d.data() }));
      setAvisos(ordenarParaPublicar(lista, hojeLocal()));
    });
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho || !vivo) return;
      const resp = await fetch('/api/avisos/holyrics', { headers: cabecalho });
      if (!resp.ok || !vivo) return;
      const dados = (await resp.json()) as { configurado?: boolean };
      if (vivo) setHolyricsLigado(dados.configurado === true);
    })().catch(() => {
      // Integração é opcional: não saber se está ligada não quebra a tela.
    });
    return () => {
      vivo = false;
    };
  }, []);

  const chamar = useCallback(async (caminho: string, metodo: string, corpo?: FormData) => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) {
      setErro('Sessão expirada. Recarregue a página.');
      return null;
    }
    const resp = await fetch(caminho, {
      method: metodo,
      headers: cabecalho,
      body: corpo,
    });
    const dados = await resp.json();
    if (!resp.ok) {
      setErro(dados.erro ?? 'Algo deu errado.');
      return null;
    }
    setErro(null);
    return dados;
  }, []);

  const criar = useCallback((form: FormData) => chamar('/api/avisos', 'POST', form), [chamar]);
  const remover = useCallback((id: string) => chamar(`/api/avisos/${id}`, 'DELETE'), [chamar]);

  /** Publicar/ocultar traz junto o que aconteceu do lado do Holyrics. */
  const mexerNoTelao = useCallback(
    async (id: string, publicando: boolean) => {
      setRecado(null);
      const dados = (await chamar(
        `/api/avisos/${id}/telao`,
        publicando ? 'POST' : 'DELETE',
      )) as RetornoTelao | null;
      if (!dados) return;

      const holyrics = dados.holyrics;
      if (!holyrics || holyrics.estado === 'enviado') return;

      const complemento = holyrics.motivo ?? '';
      // `nao-suportado` e `enviado-sem-imagem` não são falha: o envio fez o
      // que dava para fazer, e o recado só conta o que ficou de fora.
      const parcial =
        holyrics.estado === 'nao-suportado' ||
        holyrics.estado === 'enviado-sem-imagem';
      setRecado(
        parcial
          ? `Publicado no Coredja. ${complemento}`.trim()
          : `Publicado no Coredja, mas não foi possível enviar ao Holyrics. ${complemento}`.trim(),
      );
    },
    [chamar],
  );

  if (avisos === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-texto-fraco">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="w-full px-5 py-8 sm:px-8">
      <CabecalhoDaTela
        titulo="Avisos do Telão"
        instrucao="Cadastre durante a semana. No domingo, publique o que deve aparecer."
      />

      {/* Centralizado, não encostado à esquerda: um cartão estreito colado
          numa borda, com a lista abaixo indo até a outra, desalinha a tela. */}
      <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-borda bg-fundo-elevado p-5 sm:p-6">
        <FormularioNovoAviso onCriar={criar} />

        {erro && (
          <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--urgente)' }}>
            {erro}
          </p>
        )}
      </div>

      {recado && (
        <div
          role="status"
          className="mx-auto mt-3 max-w-3xl rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--urgente)',
            background: 'var(--urgente-fundo)',
            color: 'var(--texto)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0">{recado}</p>
            <button
              type="button"
              onClick={() => setRecado(null)}
              aria-label="Dispensar recado"
              className="shrink-0 text-texto-fraco hover:text-texto"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {avisos.length === 0 && (
          <p className="col-span-full text-sm text-texto-fraco">Nenhum aviso cadastrado.</p>
        )}
        {avisos.map((aviso) => {
          const ehDeHoje = valeNoDia(aviso, hoje);
          const soImagem = Boolean(aviso.imagem) && !aviso.titulo.trim() && !aviso.texto.trim();

          return (
            <li
              key={aviso.id}
              className="rounded-xl border px-4 py-2.5"
              style={{
                borderColor: aviso.noAr
                  ? 'var(--acento)'
                  : ehDeHoje
                    ? 'var(--borda-forte)'
                    : 'var(--borda)',
                background: aviso.noAr ? 'var(--fundo-cartao)' : 'transparent',
                opacity: ehDeHoje ? 1 : 0.72,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  {aviso.imagem && (
                    <div className="shrink-0">
                      <ImagemAnexo anexo={aviso.imagem} tamanho="h-16 w-16" />
                    </div>
                  )}
                  <div className="min-w-0">
                    {aviso.titulo ? (
                      <p className="font-medium text-texto">{aviso.titulo}</p>
                    ) : (
                      <p className="font-medium text-texto-suave">Aviso em imagem</p>
                    )}
                    {aviso.texto && <p className="mt-0.5 text-sm text-texto-suave">{aviso.texto}</p>}
                    <p className="mt-1 text-xs text-texto-fraco">
                      {aviso.dias.length === 0
                        ? 'Vale sempre'
                        : aviso.dias.map(formatarDia).join(' · ')}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  {aviso.noAr && (
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
                      style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
                    >
                      No telão
                    </span>
                  )}
                  {ehDeHoje && aviso.dias.length > 0 && (
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
                      style={{ background: 'var(--sucesso)', color: 'var(--fundo)' }}
                    >
                      Hoje
                    </span>
                  )}
                </div>
              </div>

              {/* Só faz sentido explicar isso quando a integração existe: sem
                  Holyrics configurado, ninguém espera envio automático. */}
              {holyricsLigado && soImagem && (
                <p className="mt-2 text-xs text-texto-fraco">
                  Não vai para o Holyrics automaticamente — a API dele não recebe imagens de fora.
                  Projete a arte manualmente.
                </p>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => mexerNoTelao(aviso.id, !aviso.noAr)}
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
          );
        })}
      </ul>
    </div>
  );
}

/** `"2026-08-23"` vira `"23/08"`. O ano polui e raramente importa. */
function formatarDia(dia: string): string {
  const [, mes, d] = dia.split('-');
  return `${d}/${mes}`;
}

/**
 * Cadastrar aparece para todo mundo — quem não tem `avisos:escrever` só
 * descobre isso ao tentar salvar, quando o servidor devolve 403. É a mesma
 * ideia de "pergunte fazendo" de `TelaCulto`, mas sem escondê-lo: cadastrar
 * não muda nada até o clique em Salvar, então não há custo em deixar visível
 * e deixar o erro (se vier) explicar por que não salvou.
 */
function FormularioNovoAviso({ onCriar }: { onCriar: (form: FormData) => Promise<unknown> }) {
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [imagem, setImagem] = useState<{ arquivo: File; previa: string } | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [dias, setDias] = useState<string[]>([]);
  const [diaEscolhido, setDiaEscolhido] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const podeSalvar = Boolean(titulo.trim() || imagem);

  async function escolherImagem(lista: FileList | null) {
    const original = lista?.[0];
    if (!original) return;
    setAvisoLocal(null);

    // Avisa aqui, antes do envio: subir uma arte grande pelo Wi-Fi da igreja
    // para só então receber a recusa do servidor custa tempo.
    if (original.size > TAMANHO_MAXIMO_BYTES) {
      const limite = Math.round(TAMANHO_MAXIMO_BYTES / (1024 * 1024));
      setAvisoLocal(`A imagem passa de ${limite} MB e não pode ser enviada.`);
      return;
    }

    setPreparando(true);
    try {
      const arquivo = await comprimirImagem(original);
      setImagem((atual) => {
        if (atual) URL.revokeObjectURL(atual.previa);
        return { arquivo, previa: URL.createObjectURL(arquivo) };
      });
    } finally {
      setPreparando(false);
    }
  }

  function removerImagem() {
    setImagem((atual) => {
      if (atual) URL.revokeObjectURL(atual.previa);
      return null;
    });
    if (inputArquivo.current) inputArquivo.current.value = '';
  }

  function adicionarDia() {
    if (!diaEscolhido) return;
    setDias((atuais) => (atuais.includes(diaEscolhido) ? atuais : [...atuais, diaEscolhido].sort()));
    setDiaEscolhido('');
  }

  function removerDia(dia: string) {
    setDias((atuais) => atuais.filter((d) => d !== dia));
  }

  async function salvar() {
    if (!podeSalvar) return;
    setSalvando(true);

    const form = new FormData();
    form.set('titulo', titulo);
    form.set('texto', texto);
    form.set('dias', JSON.stringify(dias));
    if (imagem) form.set('imagem', imagem.arquivo);

    const resultado = await onCriar(form);
    setSalvando(false);

    if (resultado) {
      setTitulo('');
      setTexto('');
      setDias([]);
      setDiaEscolhido('');
      removerImagem();
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

      {/* Imagem: um aviso pode ser só a arte pronta, sem título nem texto. */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-borda bg-fundo-cartao px-3 text-sm font-medium text-texto">
          {preparando ? 'Preparando…' : imagem ? 'Trocar imagem' : 'Anexar imagem'}
          <input
            ref={inputArquivo}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => escolherImagem(e.target.files)}
          />
        </label>
        {imagem && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagem.previa}
              alt="Prévia da imagem do aviso"
              className="h-10 w-10 rounded-lg border border-borda object-cover"
            />
            <button
              type="button"
              onClick={removerImagem}
              className="h-10 rounded-lg border border-borda px-3 text-sm text-texto-fraco hover:text-texto"
            >
              Remover
            </button>
          </>
        )}
      </div>

      {/* Dias: input de data + botão, sem biblioteca de calendário. */}
      <div className="mt-1 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={diaEscolhido}
            onChange={(e) => setDiaEscolhido(e.target.value)}
            aria-label="Dia em que o aviso vale"
            className="min-w-0 flex-1 rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto"
          />
          <button
            type="button"
            onClick={adicionarDia}
            disabled={!diaEscolhido}
            className="h-11 shrink-0 rounded-lg border border-borda px-4 text-sm font-medium text-texto disabled:opacity-50"
          >
            Adicionar dia
          </button>
        </div>

        {dias.length === 0 ? (
          <p className="text-xs text-texto-fraco">Sem dias marcados: vale sempre.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {dias.map((dia) => (
              <li key={dia}>
                <button
                  type="button"
                  onClick={() => removerDia(dia)}
                  aria-label={`Remover o dia ${formatarDia(dia)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-borda bg-fundo-cartao px-3 py-1 text-xs font-medium text-texto"
                >
                  {formatarDia(dia)}
                  <span aria-hidden="true" className="text-texto-fraco">
                    ✕
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {avisoLocal && (
        <p role="alert" className="text-sm" style={{ color: 'var(--urgente)' }}>
          {avisoLocal}
        </p>
      )}

      <button
        type="button"
        onClick={salvar}
        disabled={salvando || preparando || !podeSalvar}
        className="h-11 rounded-lg text-sm font-semibold disabled:opacity-50"
        style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
      >
        {salvando ? 'Salvando…' : 'Cadastrar aviso'}
      </button>
    </div>
  );
}
