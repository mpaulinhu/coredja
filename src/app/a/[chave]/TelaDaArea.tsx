'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagemAnexo } from '@/components/ImagemAnexo';
import { useEventos } from '@/hooks/useEventos';
import { hora } from '@/lib/formatar';
import { MAXIMO_ANEXOS, TAMANHO_MAXIMO_BYTES } from '@/lib/limites';
import type { Area, Mensagem } from '@/lib/types';

/**
 * Tela de envio de uma área.
 *
 * Pensada para uso no celular, em pé, com pressa: campo de texto grande, um
 * botão de imagem, uma chave de urgente e um botão de enviar que ocupa a
 * largura toda. A conversa fica acima, para a área ver o que já mandou e o que
 * o audiovisual respondeu.
 */

interface Props {
  area: Area;
  chave: string;
  mensagensIniciais: Mensagem[];
}

interface ImagemSelecionada {
  arquivo: File;
  /** URL temporária de pré-visualização, criada no navegador. */
  previa: string;
}

export function TelaDaArea({ area, chave, mensagensIniciais }: Props) {
  const [mensagens, setMensagens] = useState(mensagensIniciais);
  const [texto, setTexto] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [imagens, setImagens] = useState<ImagemSelecionada[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const inputArquivo = useRef<HTMLInputElement>(null);
  const fimDaConversa = useRef<HTMLDivElement>(null);

  const recarregar = useCallback(async () => {
    try {
      const resposta = await fetch(`/api/areas/${chave}/mensagens`, {
        cache: 'no-store',
      });
      if (!resposta.ok) return;
      const dados = (await resposta.json()) as { mensagens: Mensagem[] };
      setMensagens(dados.mensagens);
    } catch {
      // Falha de rede momentânea: a próxima atualização corrige.
    }
  }, [chave]);

  // Só recarrega quando o evento é desta área — o aviso de um recado do Kids
  // não precisa mexer na tela da Cantina.
  useEventos(
    useCallback(
      (evento) => {
        if (evento.areaSlug === area.slug) void recarregar();
      },
      [area.slug, recarregar],
    ),
  );

  useEffect(() => {
    fimDaConversa.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length]);

  // As URLs de pré-visualização seguram memória até serem liberadas.
  useEffect(() => {
    return () => {
      for (const img of imagens) URL.revokeObjectURL(img.previa);
    };
    // Roda só na saída da tela; a remoção individual é tratada em removerImagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function adicionarImagens(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setErro(null);

    const espacoLivre = MAXIMO_ANEXOS - imagens.length;
    if (espacoLivre <= 0) {
      setErro(`Máximo de ${MAXIMO_ANEXOS} imagens por recado.`);
      return;
    }

    const escolhidas = Array.from(lista).slice(0, espacoLivre);

    // Avisa aqui, antes do envio: subir uma foto grande pelo Wi-Fi da igreja
    // para só então receber a recusa do servidor custa tempo no meio do culto.
    const grande = escolhidas.find((a) => a.size > TAMANHO_MAXIMO_BYTES);
    if (grande) {
      const limite = Math.round(TAMANHO_MAXIMO_BYTES / (1024 * 1024));
      setErro(`"${grande.name}" passa de ${limite} MB e não pode ser enviada.`);
      return;
    }

    const novas = escolhidas.map((arquivo) => ({
      arquivo,
      previa: URL.createObjectURL(arquivo),
    }));

    setImagens((atuais) => [...atuais, ...novas]);
  }

  function removerImagem(indice: number) {
    setImagens((atuais) => {
      const alvo = atuais[indice];
      if (alvo) URL.revokeObjectURL(alvo.previa);
      return atuais.filter((_, i) => i !== indice);
    });
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviando) return;

    const conteudo = texto.trim();
    if (!conteudo && imagens.length === 0) {
      setErro('Escreva um recado ou anexe uma imagem.');
      return;
    }

    setEnviando(true);
    setErro(null);

    const form = new FormData();
    form.set('texto', conteudo);
    form.set('prioridade', urgente ? 'urgente' : 'normal');
    for (const img of imagens) form.append('imagens', img.arquivo);

    try {
      const resposta = await fetch(`/api/areas/${chave}/mensagens`, {
        method: 'POST',
        body: form,
      });

      if (!resposta.ok) {
        const dados = (await resposta.json().catch(() => ({}))) as {
          erro?: string;
        };
        setErro(dados.erro ?? 'Não foi possível enviar. Tente de novo.');
        return;
      }

      for (const img of imagens) URL.revokeObjectURL(img.previa);
      setTexto('');
      setUrgente(false);
      setImagens([]);
      if (inputArquivo.current) inputArquivo.current.value = '';

      // Confirmação visível: quem envia precisa saber que chegou, sem ter de
      // conferir a conversa.
      setEnviado(true);
      setTimeout(() => setEnviado(false), 2500);

      await recarregar();
    } catch {
      setErro('Sem conexão com o audiovisual. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-fundo">
      <header
        className="sticky top-0 z-10 border-b border-borda bg-fundo-elevado/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
          <span
            className="h-9 w-9 shrink-0 rounded-full"
            style={{ background: area.cor }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-texto">
              {area.nome}
            </h1>
            <p className="text-xs text-texto-fraco">Recados para o audiovisual</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        {mensagens.length === 0 ? (
          <p className="py-10 text-center text-sm text-texto-fraco">
            Nenhum recado ainda. Escreva abaixo para falar com o audiovisual.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {mensagens.map((mensagem) => (
              <BalaoMensagem
                key={mensagem.id}
                mensagem={mensagem}
                corDaArea={area.cor}
              />
            ))}
          </ul>
        )}
        <div ref={fimDaConversa} />
      </main>

      <form
        onSubmit={enviar}
        className="sticky bottom-0 border-t border-borda bg-fundo-elevado/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          {imagens.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2">
              {imagens.map((img, indice) => (
                <li key={img.previa} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.previa}
                    alt={img.arquivo.name}
                    className="h-16 w-16 rounded-lg border border-borda object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removerImagem(indice)}
                    aria-label={`Remover ${img.arquivo.name}`}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-borda-forte bg-fundo-cartao text-sm leading-none text-texto-suave"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {erro && (
            <p
              role="alert"
              className="mb-2 rounded-lg bg-urgente-fundo px-3 py-2 text-sm text-urgente"
            >
              {erro}
            </p>
          )}

          {enviado && (
            <p
              role="status"
              className="mb-2 rounded-lg px-3 py-2 text-sm text-sucesso"
              style={{ background: 'rgb(63 178 127 / 0.12)' }}
            >
              Recado enviado ao audiovisual.
            </p>
          )}

          <label htmlFor="texto" className="sr-only">
            Recado
          </label>
          <textarea
            id="texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva o recado…"
            rows={2}
            /* 16px é o mínimo que impede o iOS de dar zoom ao focar o campo. */
            className="w-full resize-none rounded-xl border border-borda bg-fundo-cartao px-3 py-3 text-[16px] text-texto placeholder:text-texto-fraco"
          />

          <div className="mt-3 flex items-center gap-2">
            <input
              ref={inputArquivo}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => adicionarImagens(e.target.files)}
              className="hidden"
              id="imagens"
            />
            <button
              type="button"
              onClick={() => inputArquivo.current?.click()}
              className="flex h-12 items-center gap-2 rounded-xl border border-borda bg-fundo-cartao px-4 text-sm font-medium text-texto-suave active:bg-borda"
            >
              <IconeImagem />
              Imagem
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={urgente}
              onClick={() => setUrgente((v) => !v)}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors"
              style={
                urgente
                  ? {
                      background: 'var(--urgente-fundo)',
                      borderColor: 'var(--urgente)',
                      color: 'var(--urgente)',
                    }
                  : {
                      background: 'var(--fundo-cartao)',
                      borderColor: 'var(--borda)',
                      color: 'var(--texto-suave)',
                    }
              }
            >
              {urgente ? '● Urgente' : '○ Urgente'}
            </button>
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="mt-3 h-14 w-full rounded-xl text-base font-bold text-white disabled:opacity-60"
            style={{ background: urgente ? 'var(--urgente)' : area.cor }}
          >
            {enviando ? 'Enviando…' : 'Enviar recado'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Um recado na conversa: à direita se foi a área, à esquerda se foi o AV. */
function BalaoMensagem({
  mensagem,
  corDaArea,
}: {
  mensagem: Mensagem;
  corDaArea: string;
}) {
  const daArea = mensagem.autor === 'area';

  return (
    <li className={`flex ${daArea ? 'justify-end' : 'justify-start'}`}>
      <div
        className="entrada max-w-[85%] rounded-2xl border px-3.5 py-2.5"
        style={{
          background: daArea ? 'var(--fundo-cartao)' : 'var(--fundo-elevado)',
          borderColor:
            mensagem.prioridade === 'urgente'
              ? 'var(--urgente)'
              : 'var(--borda)',
        }}
      >
        {!daArea && (
          <p className="mb-1 text-xs font-semibold text-acento">Audiovisual</p>
        )}

        {mensagem.prioridade === 'urgente' && daArea && (
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-urgente">
            Urgente
          </p>
        )}

        {mensagem.texto && (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-texto">
            {mensagem.texto}
          </p>
        )}

        {mensagem.anexos.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {mensagem.anexos.map((anexo) => (
              <li key={anexo.id}>
                <ImagemAnexo anexo={anexo} tamanho="h-28 w-28" />
              </li>
            ))}
          </ul>
        )}

        <p
          className="mt-1.5 text-right text-[11px]"
          style={{ color: daArea ? corDaArea : 'var(--texto-fraco)' }}
        >
          {hora(mensagem.criadaEm)}
          {mensagem.resolvidaEm && daArea && ' · visto'}
        </p>
      </div>
    </li>
  );
}

function IconeImagem() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
