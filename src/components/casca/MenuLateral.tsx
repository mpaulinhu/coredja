'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import { IconeFechar } from './IconesMenu';
import { EquipeDeHoje } from './EquipeDeHoje';

/**
 * Menu lateral do Coredja.
 *
 * A casca comum das telas internas — hoje só o Painel, mas é aqui que Ordem
 * do Culto, Avisos e Escala entram conforme forem sendo construídas. Cada
 * item aponta para uma rota dentro de `src/app/(app)/`.
 *
 * Fica fora do `(app)/layout.tsx` como componente próprio, e não dentro dele
 * direto, para o layout continuar simples de ler: ele monta a moldura, este
 * arquivo decide o que aparece nela.
 *
 * Responsivo (ELO local, sem issue — bug de layout achado pelo Marcos):
 * abaixo de `md` este componente vira uma GAVETA por cima do conteúdo
 * (controlada por `aberto`/`aoFechar`, estado que mora em `CascaApp`), em vez
 * de coluna fixa sempre visível. De `md` para cima, comportamento igual ao
 * de sempre — coluna estática, sem gaveta nem overlay.
 */

interface ItemDeMenu {
  href: string;
  rotulo: string;
  /** Id da aba em `ABAS` (`papeis.ts`) — é o que o admin liga/desliga. */
  aba: string;
  /** Rotas futuras já aparecem no menu, desativadas, para o conjunto ficar
   *  visível desde já — ver nota em `EM_BREVE` abaixo. */
  emBreve?: boolean;
}

const ITENS: ItemDeMenu[] = [
  { href: '/painel', rotulo: 'Recados', aba: 'painel' },
  { href: '/culto', rotulo: 'Ordem do Culto', aba: 'culto' },
  { href: '/avisos', rotulo: 'Avisos do Telão', aba: 'avisos' },
  // Logo abaixo de Avisos do Telão: são os dois itens do domingo em que
  // alguém pega um texto pronto e o publica em algum lugar — um no telão da
  // igreja, outro no chat da transmissão. Visível a todo mundo logado, e não
  // só a quem cadastra, porque copiar é o uso principal da tela e não exige
  // permissão nenhuma.
  { href: '/ao-vivo', rotulo: 'Ao Vivo', aba: 'ao-vivo' },
  // Escala do Time oculta: a igreja já usa o Voluts para isso (19/08/2026).
  // O código continua em src/app/(app)/escala/ e src/lib/escala*.ts, caso
  // um dia volte a fazer sentido — só a entrada de menu foi removida.
];

/** Itens que só o admin vê — ver `ehAdmin` abaixo. */
const ITENS_DE_ADMIN: ItemDeMenu[] = [
  { href: '/usuarios', rotulo: 'Usuários', aba: 'usuarios' },
  { href: '/departamentos', rotulo: 'Departamentos', aba: 'departamentos' },
  // Por último de propósito: é a tela que menos se abre no dia a dia — só ao
  // instalar o Coredja em outro lugar, ou quando algo parou de funcionar.
  { href: '/configuracoes', rotulo: 'Configurações', aba: 'configuracoes' },
];

interface MenuLateralProps {
  /** Verdadeiro só importa abaixo de `md` — controla a gaveta aberta/fechada. */
  aberto: boolean;
  aoFechar: () => void;
}

export function MenuLateral({ aberto, aoFechar }: MenuLateralProps) {
  const caminho = usePathname();
  const botaoFecharRef = useRef<HTMLButtonElement>(null);

  // Os itens de admin só aparecem para quem pode de fato usá-los. O menu não
  // sabe o papel de quem está logado — pergunta ao servidor, mesmo "pergunte
  // fazendo" de `TelaCulto`: uma fonte de verdade só, não duas checagens de
  // permissão que podem um dia divergir.
  //
  // Aqui a pergunta é `/api/departamentos` e não `/api/pessoas` porque essa
  // rota já devolve a permissão como dado (`podeEditar`). `/api/pessoas`
  // responde 403 a quem não é admin, e ler permissão do status HTTP confunde
  // "sem acesso" com "rota fora do ar" — as duas permissões são exclusivas de
  // admin, então um campo explícito cobre os dois itens.
  // `null` enquanto a resposta não chega: mostrar o menu inteiro e depois
  // encolher faria os itens piscarem a cada carga de página.
  const [abas, setAbas] = useState<string[] | null>(null);
  useEffect(() => {
    (async () => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return;
      const resp = await fetch('/api/meu-acesso', { headers: cabecalho });
      if (!resp.ok) return;
      const dados = (await resp.json().catch(() => ({}))) as { abas?: string[] };
      setAbas(Array.isArray(dados.abas) ? dados.abas : []);
    })();
  }, []);

  const itens =
    abas === null ? [] : [...ITENS, ...ITENS_DE_ADMIN].filter((i) => abas.includes(i.aba));

  // Navegar por qualquer caminho (item do menu, ou link dentro do conteúdo
  // da própria página) fecha a gaveta — sem isso ela fica aberta por cima da
  // tela nova até o usuário fechar à mão.
  useEffect(() => {
    aoFechar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminho]);

  // Foco visível dentro da gaveta ao abrir, para quem navega por teclado —
  // sem isso o foco fica "perdido" atrás do overlay.
  useEffect(() => {
    if (aberto) botaoFecharRef.current?.focus();
  }, [aberto]);

  return (
    <>
      {/* Overlay: só existe (e só recebe clique) com a gaveta aberta abaixo
          de `md`. Em telas `md+` o menu nunca é gaveta, então isto some. */}
      {aberto && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={aoFechar}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      {/*
        Visual vindo da tela de referência dos Avisos do Telão (20/08/2026,
        "a lateral de navegação pode pegar igual também, gostei"): coluna mais
        larga (272px), itens mais altos e mais arredondados, e o item ativo
        marcado por uma FAIXA de acento colada na borda esquerda
        (`box-shadow: inset`) em vez de só um fundo esmaecido. A faixa é o que
        faz o item ativo se ler de relance no escuro, que é a condição real de
        uso no domingo.

        SEM ÍCONE em cada item, também como na referência — os `<a>` dela são
        texto puro. Uma primeira versão daqui trouxe um SVG por item, que não
        veio de lugar nenhum: com sete rótulos curtos e claros, o ícone não
        ajuda a achar mais rápido e ainda cria o problema de desenhar sete
        símbolos igualmente legíveis a 20px (a engrenagem de Configurações
        chegou a sair parecida com o sol do botão de tema). Medidas conferidas
        contra a referência: gap 4px entre itens, 14px/16px de recheio, canto
        de 12px.

        `overflow-y-auto` no `<nav>`: com a caixa "EQUIPE DE HOJE" no rodapé,
        num celular deitado o conteúdo pode passar da altura da janela — sem
        isso o rodapé fica inalcançável.
      */}
      <nav
        aria-label="Menu principal"
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-[272px] max-w-[85vw] shrink-0 flex-col overflow-y-auto border-r border-borda bg-fundo-elevado transition-transform duration-200 ease-out md:static md:z-auto md:max-w-none md:translate-x-0 ${
          aberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between gap-2 px-6 py-6">
          <div className="min-w-0">
            <Link
              href="/"
              className="text-[22px] font-extrabold tracking-[-0.02em] text-texto"
            >
              Coredja
            </Link>
            <p className="mt-1 text-[13px] text-texto-fraco">
              Comunicação interna da igreja
            </p>
          </div>

          {/* Só existe visualmente no celular — no desktop a gaveta não abre,
              então não faz sentido oferecer um jeito de "fechar" algo estático. */}
          <button
            ref={botaoFecharRef}
            type="button"
            aria-label="Fechar menu"
            onClick={aoFechar}
            className="-mr-1.5 shrink-0 cursor-pointer rounded-lg p-2 text-texto-suave hover:bg-fundo-cartao hover:text-texto md:hidden"
          >
            <IconeFechar />
          </button>
        </div>

        <ul className="flex flex-col gap-1 px-4">
          {itens.map((item) => {
            const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`);

            if (item.emBreve) {
              return (
                <li key={item.href}>
                  <span
                    className="flex cursor-not-allowed items-center gap-3.5 rounded-xl px-4 py-3.5 text-[15px] text-texto-fraco opacity-60"
                    title="Ainda não construída"
                  >
                    {item.rotulo}
                    <span className="ml-auto text-[10px] tracking-wide text-texto-fraco uppercase">
                      em breve
                    </span>
                  </span>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={ativo ? 'page' : undefined}
                  className={`flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-[15px] transition-colors ${
                    ativo
                      ? 'font-bold'
                      : 'font-semibold text-texto-suave hover:bg-fundo-cartao hover:text-texto'
                  }`}
                  style={
                    ativo
                      ? {
                          background: 'var(--acento-suave-fundo)',
                          color: 'var(--acento-texto-sobre-fundo)',
                          boxShadow: 'inset 2px 0 0 var(--acento)',
                        }
                      : undefined
                  }
                >
                  {item.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Rodapé: quem está em cada função hoje, derivado dos responsáveis
            dos blocos da ordem ativa (ver `EquipeDeHoje`). Fica aqui, e não
            só na tela do culto, porque é a informação que alguém procura no
            domingo estando em qualquer tela.

            `mt-auto` empurra para baixo; `pt-6` garante respiro mesmo quando
            a lista de itens é curta e o rodapé sobe. */}
        <div className="mt-auto flex flex-col gap-3.5 px-5 pt-6 pb-6">
          <EquipeDeHoje />
          <Link
            href="/"
            className="px-2 text-[13px] text-texto-fraco transition-colors hover:text-acento-forte"
          >
            ← Voltar para a home
          </Link>
        </div>
      </nav>
    </>
  );
}
