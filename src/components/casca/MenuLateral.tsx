'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import {
  IconeAoVivo,
  IconeAvisos,
  IconeCulto,
  IconeDepartamentos,
  IconeFechar,
  IconeRecados,
  IconeUsuarios,
} from './IconesMenu';
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
  Icone: ComponentType<{ className?: string }>;
  /** Rotas futuras já aparecem no menu, desativadas, para o conjunto ficar
   *  visível desde já — ver nota em `EM_BREVE` abaixo. */
  emBreve?: boolean;
}

const ITENS: ItemDeMenu[] = [
  { href: '/painel', rotulo: 'Recados', Icone: IconeRecados },
  { href: '/culto', rotulo: 'Ordem do Culto', Icone: IconeCulto },
  { href: '/avisos', rotulo: 'Avisos do Telão', Icone: IconeAvisos },
  // Logo abaixo de Avisos do Telão: são os dois itens do domingo em que
  // alguém pega um texto pronto e o publica em algum lugar — um no telão da
  // igreja, outro no chat da transmissão. Visível a todo mundo logado, e não
  // só a quem cadastra, porque copiar é o uso principal da tela e não exige
  // permissão nenhuma.
  { href: '/ao-vivo', rotulo: 'Ao Vivo', Icone: IconeAoVivo },
  // Escala do Time oculta: a igreja já usa o Voluts para isso (19/08/2026).
  // O código continua em src/app/(app)/escala/ e src/lib/escala*.ts, caso
  // um dia volte a fazer sentido — só a entrada de menu foi removida.
];

/** Itens que só o admin vê — ver `ehAdmin` abaixo. */
const ITENS_DE_ADMIN: ItemDeMenu[] = [
  { href: '/usuarios', rotulo: 'Usuários', Icone: IconeUsuarios },
  { href: '/departamentos', rotulo: 'Departamentos', Icone: IconeDepartamentos },
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
  const [ehAdmin, setEhAdmin] = useState(false);
  useEffect(() => {
    (async () => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return;
      const resp = await fetch('/api/departamentos', { headers: cabecalho });
      if (!resp.ok) return;
      const dados = await resp.json().catch(() => ({}));
      setEhAdmin(dados.podeEditar === true);
    })();
  }, []);

  const itens = ehAdmin ? [...ITENS, ...ITENS_DE_ADMIN] : ITENS;

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

      <nav
        aria-label="Menu principal"
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] shrink-0 flex-col border-r border-borda bg-fundo-elevado transition-transform duration-200 ease-out md:static md:z-auto md:w-64 md:max-w-none md:translate-x-0 ${
          aberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between px-5 py-6">
          <div>
            <Link href="/" className="text-lg font-bold tracking-tight text-texto">
              Coredja
            </Link>
            <p className="mt-0.5 text-xs text-texto-fraco">
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
            className="rounded-lg p-1.5 text-texto-suave hover:bg-fundo-cartao hover:text-texto md:hidden"
          >
            <IconeFechar />
          </button>
        </div>

        <ul className="flex flex-col gap-1 px-3">
          {itens.map((item) => {
            const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`);

            if (item.emBreve) {
              return (
                <li key={item.href}>
                  <span
                    className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-texto-fraco opacity-60"
                    title="Ainda não construída"
                  >
                    <item.Icone className="shrink-0" />
                    {item.rotulo}
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-texto-fraco">
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
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    ativo
                      ? 'bg-acento/15 text-texto'
                      : 'text-texto-suave hover:bg-fundo-cartao hover:text-texto'
                  }`}
                >
                  <item.Icone className="shrink-0" />
                  {item.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Rodapé: quem está em cada função hoje, derivado dos responsáveis
            dos blocos da ordem ativa (ver `EquipeDeHoje`). Fica aqui, e não
            só na tela do culto, porque é a informação que alguém procura no
            domingo estando em qualquer tela. */}
        <div className="mt-auto flex flex-col gap-4 px-4 py-5">
          <EquipeDeHoje />
          <Link
            href="/"
            className="px-1 text-xs text-texto-fraco hover:text-texto-suave"
          >
            ← Voltar para a home
          </Link>
        </div>
      </nav>
    </>
  );
}
