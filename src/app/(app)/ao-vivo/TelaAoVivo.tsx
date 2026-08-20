'use client';

import { collection, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import { CabecalhoDaTela } from '@/components/CabecalhoDaTela';
import { getFirestoreCliente } from '@/lib/firebase-cliente';
import {
  agruparPorCategoria,
  normalizarMensagemDaLive,
  SEM_CATEGORIA,
  type MensagemDaLive,
} from '@/lib/live';
import { Recado } from '@/components/Recado';
import { CartaoDaMensagem, SugestoesDeCategoria } from './CartaoDaMensagem';
import { copiarTexto } from './copiar';
import { EscreverNaHora } from './EscreverNaHora';

/** Quanto tempo o "Copiado!" fica na tela antes de sumir sozinho. */
const DURACAO_DO_AVISO_MS = 2000;

/**
 * Valor do filtro que significa "mostre todas as categorias". Um símbolo, e
 * não a string "Todas", para não colidir com uma categoria que alguém
 * resolva chamar exatamente assim.
 */
const TODAS = Symbol('todas');

type Filtro = typeof TODAS | string;

/**
 * Ao Vivo: as mensagens prontas para colar no chat da transmissão.
 *
 * O Coredja não fala com o YouTube nem com o Instagram — o destino é sempre
 * a área de transferência, e quem cola é a pessoa. Por isso a tela inteira é
 * desenhada em torno de um gesto só: achar a mensagem e clicar nela.
 *
 * `podeEditar` vem do servidor junto com a lista (ver `GET
 * /api/live/mensagens`), pelo mesmo motivo de `TelaDepartamentos`: a rota
 * responde 200 a qualquer pessoa logada, então a tela não teria como deduzir
 * a permissão pelo status HTTP. Quem só opera a live copia tudo e não vê
 * nenhum botão de cadastrar.
 */
export function TelaAoVivo() {
  const [mensagens, setMensagens] = useState<MensagemDaLive[] | undefined>(undefined);
  const [podeEditar, setPodeEditar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [copiadaId, setCopiadaId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>(TODAS);

  // O timer do "Copiado!" precisa ser cancelável: copiar duas mensagens em
  // sequência rápida deixaria o timer da primeira apagando o aviso da segunda.
  const timerDoAviso = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timerDoAviso.current) clearTimeout(timerDoAviso.current);
    },
    [],
  );

  /**
   * A permissão e a primeira lista vêm do servidor; a partir daí o Firestore
   * mantém a lista viva. As duas fontes convivem como em `TelaAvisos`: o
   * `onSnapshot` é quem manda no conteúdo, e esta chamada existe sobretudo
   * pelo `podeEditar`, que o Firestore não tem como responder.
   */
  const carregar = useCallback(async () => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) {
      setErro('Sessão expirada. Recarregue a página.');
      setMensagens([]);
      return;
    }
    const resp = await fetch('/api/live/mensagens', { headers: cabecalho });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setErro(dados.erro ?? 'Não foi possível carregar as mensagens.');
      setMensagens([]);
      return;
    }
    setErro(null);
    setMensagens(Array.isArray(dados.mensagens) ? dados.mensagens : []);
    setPodeEditar(dados.podeEditar === true);
  }, []);

  useEffect(() => {
    // O `await` dentro da IIFE não é decorativo: sem ele o lint entende a
    // chamada como um `setState` síncrono dentro do efeito. Mesmo formato de
    // `TelaDepartamentos`.
    (async () => {
      await carregar();
    })();
  }, [carregar]);

  useEffect(() => {
    const db = getFirestoreCliente();
    if (!db) return;
    return onSnapshot(collection(db, 'mensagens_live'), (snap) => {
      setMensagens(
        snap.docs.map((d) => normalizarMensagemDaLive({ id: d.id, ...d.data() })),
      );
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
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setErro(dados.erro ?? 'Algo deu errado.');
      return null;
    }
    setErro(null);
    return dados;
  }, []);

  /**
   * Copia e avisa. O contador vai ao servidor DEPOIS da cópia e sem esperar
   * resposta: ele é conveniência de ordenação, e ao vivo ninguém pode ficar
   * olhando um "copiando…" enquanto a rede decide.
   */
  const copiar = useCallback(
    async (mensagem: MensagemDaLive) => {
      const resultado = await copiarTexto(mensagem.texto);

      if (!resultado.ok) {
        setCopiadaId(null);
        setRecado(resultado.motivo);
        return;
      }

      setRecado(null);
      setCopiadaId(mensagem.id);
      if (timerDoAviso.current) clearTimeout(timerDoAviso.current);
      timerDoAviso.current = setTimeout(() => setCopiadaId(null), DURACAO_DO_AVISO_MS);

      void chamar(`/api/live/mensagens/${mensagem.id}/copia`, 'POST');
    },
    [chamar],
  );

  const criar = useCallback(
    async (texto: string, categoria: string) => {
      const dados = await chamar('/api/live/mensagens', 'POST', { texto, categoria });
      if (!dados) return { ok: false };
      await carregar();
      return { ok: true };
    },
    [chamar, carregar],
  );

  const atualizar = useCallback(
    async (id: string, texto: string, categoria: string) => {
      await chamar(`/api/live/mensagens/${id}`, 'PUT', { texto, categoria });
    },
    [chamar],
  );

  const remover = useCallback(
    async (id: string) => {
      await chamar(`/api/live/mensagens/${id}`, 'DELETE');
    },
    [chamar],
  );

  const grupos = useMemo(() => agruparPorCategoria(mensagens ?? []), [mensagens]);
  const categorias = useMemo(
    () => grupos.map((g) => g.categoria).filter((c) => c !== SEM_CATEGORIA),
    [grupos],
  );

  // Um filtro apontando para uma categoria que acabou de sumir (a última
  // mensagem dela foi apagada ou movida) deixaria a tela vazia sem
  // explicação — nesse caso ele volta sozinho para "Todas". Derivado no
  // render, e não corrigido num efeito, para não repintar duas vezes.
  const filtroValido: Filtro =
    filtro === TODAS || grupos.some((g) => g.categoria === filtro) ? filtro : TODAS;
  const visiveis =
    filtroValido === TODAS ? grupos : grupos.filter((g) => g.categoria === filtroValido);

  if (mensagens === undefined) {
    return (
      <div className="flex h-full items-center justify-center px-5">
        <p className="text-sm text-texto-fraco">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="w-full px-5 py-8 sm:px-8">
      <CabecalhoDaTela
        titulo="Ao Vivo"
        instrucao="Toque numa mensagem para copiar, e cole no chat do YouTube ou do Instagram."
      />

      {erro && (
        <p
          role="alert"
          className="mx-auto mt-3 max-w-3xl text-sm"
          style={{ color: 'var(--urgente)' }}
        >
          {erro}
        </p>
      )}

      {recado && <Recado texto={recado} onDispensar={() => setRecado(null)} />}

      {/* Um campo só: escrever e decidir ali mesmo se copia ou guarda. Havia
          um segundo bloco de cadastro, que pedia o mesmo texto e a mesma
          categoria — duas caixas para a mesma frase. */}
      <div className="mx-auto mt-4 max-w-3xl">
        <EscreverNaHora
          onCopiar={async (texto) => {
            const resultado = await copiarTexto(texto);
            if (resultado.ok) {
              setRecado(null);
              return true;
            }
            setRecado(resultado.motivo);
            return false;
          }}
          onSalvar={podeEditar ? criar : undefined}
        />
      </div>

      {/* Filtro por categoria: rola na horizontal no celular em vez de
          quebrar em três linhas de chips, que empurrariam as mensagens para
          fora da primeira dobra justo quando a pressa é maior. Só aparece com
          duas categorias ou mais — com uma só ele não filtraria nada. */}
      {grupos.length > 1 && (
        <div className="mx-auto mt-6 max-w-3xl">
          <div
            role="group"
            aria-label="Filtrar por categoria"
            className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0"
          >
            <ChipDeFiltro
              rotulo="Todas"
              ativo={filtroValido === TODAS}
              onClick={() => setFiltro(TODAS)}
            />
            {grupos.map((grupo) => (
              <ChipDeFiltro
                key={grupo.categoria}
                rotulo={`${grupo.categoria} (${grupo.mensagens.length})`}
                ativo={filtroValido === grupo.categoria}
                onClick={() => setFiltro(grupo.categoria)}
              />
            ))}
          </div>
        </div>
      )}

      <SugestoesDeCategoria existentes={categorias} />

      <div className="mx-auto mt-4 max-w-3xl">
        {grupos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-borda px-4 py-8 text-center text-sm text-texto-fraco">
            {podeEditar
              ? 'Nenhuma mensagem cadastrada ainda. Cadastre a primeira aí em cima — por exemplo, a de boas-vindas que vocês sempre mandam no começo da live.'
              : 'Nenhuma mensagem cadastrada ainda. Use o campo acima para escrever e copiar na hora.'}
          </p>
        ) : (
          visiveis.map((grupo) => (
            <section key={grupo.categoria} className="mt-5 first:mt-0">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-texto-fraco">
                {grupo.categoria}
              </h2>
              <ul className="flex flex-col gap-2">
                {grupo.mensagens.map((mensagem) => (
                  <CartaoDaMensagem
                    key={mensagem.id}
                    mensagem={mensagem}
                    podeEditar={podeEditar}
                    copiada={copiadaId === mensagem.id}
                    onCopiar={() => copiar(mensagem)}
                    onAtualizar={(texto, categoria) =>
                      atualizar(mensagem.id, texto, categoria)
                    }
                    onRemover={() => remover(mensagem.id)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function ChipDeFiltro({
  rotulo,
  ativo,
  onClick,
}: {
  rotulo: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className="h-11 shrink-0 rounded-full border px-4 text-sm font-medium"
      style={{
        borderColor: ativo ? 'var(--acento)' : 'var(--borda)',
        background: ativo ? 'var(--acento)' : 'transparent',
        color: ativo ? 'var(--acento-texto)' : 'var(--texto-suave)',
      }}
    >
      {rotulo}
    </button>
  );
}
