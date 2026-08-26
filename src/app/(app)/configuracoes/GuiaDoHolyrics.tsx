import { ACOES_DO_HOLYRICS } from '@/lib/configuracoes-compartilhado';

/**
 * Como pegar o endereço e o token dentro do Holyrics.
 *
 * Fica ao lado dos campos, e não atrás de um link para a documentação, porque
 * quem chega aqui está justamente com o Holyrics aberto na outra janela
 * tentando descobrir onde clicar. Documentação num link é documentação que
 * ninguém abre no domingo de manhã.
 *
 * O conteúdo é o que foi verificado contra um Holyrics real (20/08/2026) —
 * incluindo a lista de permissões, que é a causa nº 1 de "configurei e não
 * funcionou": o token pode estar perfeito e a ação vir 401 mesmo assim.
 */
export function GuiaDoHolyrics() {
  return (
    <aside className="rounded-xl border border-borda bg-fundo-cartao p-5 lg:col-span-7">
      <h3 className="text-sm font-bold text-texto">Onde achar isso no Holyrics</h3>

      <ol className="mt-3 flex flex-col gap-3">
        <Passo numero={1} titulo="Abra o API Server">
          No Holyrics: <Caminho>Configurações → API Server</Caminho>. Ligue o
          servidor. É ali que aparecem o IP e a porta (normalmente 8091) que vão
          no campo de endereço ao lado.
        </Passo>

        <Passo numero={2} titulo="Gere um token">
          Ainda no API Server, em <Caminho>gerenciar permissões</Caminho>, crie
          uma permissão nova. Ela vem com um token — é ele que vai no campo
          Token.
        </Passo>

        <Passo numero={3} titulo="Libere as ações abaixo">
          Cada ação precisa ser marcada individualmente, na coluna{' '}
          <strong className="font-semibold text-texto">Local</strong>. Sem isso o
          Holyrics recusa mesmo com o token certo.
        </Passo>
      </ol>

      <ul className="mt-4 flex flex-col gap-3 border-t border-borda pt-4">
        {ACOES_DO_HOLYRICS.map((item) => (
          <li key={item.acao}>
            <code className="font-mono text-[12px] font-semibold text-texto">
              {item.acao}
            </code>
            <p className="text-[12px] leading-snug text-texto-fraco">
              {item.paraQue}
            </p>
            {/* O que quebra sem ela, e não só para que ela serve: o sintoma é
                o que a pessoa tem em mãos quando volta aqui procurando o que
                faltou marcar. Foi assim que um `401` em
                `CloseCurrentPresentation` custou uma noite de diagnóstico —
                a lista da tela nem citava essa ação. */}
            <p className="mt-0.5 text-[12px] leading-snug" style={{ color: 'var(--alerta)' }}>
              Sem ela: {item.seFaltar}
            </p>
          </li>
        ))}
      </ul>

      {/* O erro que o `401` produz é indistinguível de "token errado" para
          quem lê só a mensagem do Holyrics — que fala em token justamente
          quando o problema é permissão. Dizer isso aqui evita a pessoa ir
          trocar um token que estava certo. */}
      <p className="mt-3 text-[12px] leading-relaxed text-texto-fraco">
        <strong className="font-semibold text-texto-suave">
          Marcou todas e ainda dá erro 401?
        </strong>{' '}
        401 quase sempre é ação não liberada, não token errado — o Holyrics
        responde citando o token mesmo quando o token está certo. Confira se
        cada linha acima está marcada na coluna Local, uma por uma: ele não
        tem &ldquo;liberar tudo&rdquo;.
      </p>

      {/* Este bloco dizia "hospedado, o teste sempre vai dar tempo esgotado"
          e "imagem precisa ser projetada à mão" — as duas coisas deixaram de
          valer quando o Conector passou a existir, e mandavam quem instala
          procurar problema de rede onde não havia. Corrigido em 26/08/2026. */}
      <div
        className="mt-4 rounded-lg border px-3 py-2.5"
        style={{
          borderColor: 'var(--borda-forte)',
          background: 'var(--fundo-elevado)',
        }}
      >
        <p className="text-[12px] font-bold text-texto">
          Quem alcança o Holyrics é a rede da igreja
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-texto-suave">
          Quem fala com o Holyrics é o servidor do Coredja, nunca o navegador —
          é assim que o token não chega ao seu computador. Um endereço{' '}
          <code className="font-mono">192.168.x.x</code> só existe dentro da
          rede da igreja, então:
        </p>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-[12px] leading-relaxed text-texto-suave">
          <li>
            <strong className="font-semibold text-texto-suave">
              Coredja no PC do audiovisual:
            </strong>{' '}
            fala direto com o Holyrics. Não precisa de Conector para texto e
            cronômetro — só para a arte.
          </li>
          <li>
            <strong className="font-semibold text-texto-suave">
              Coredja publicado na internet:
            </strong>{' '}
            o servidor não alcança a rede da igreja, e{' '}
            <strong className="font-semibold text-texto-suave">
              tudo passa pelo Conector
            </strong>
            . Sem ele rodando, nada chega ao telão — nem texto. O teste dirá
            &ldquo;Conectado pela ponte&rdquo;, que é o resultado certo aqui.
          </li>
        </ul>
      </div>

      {/* A arte era mesmo impossível antes do Conector — e o texto antigo
          ("projete à mão") virou o oposto da verdade quando ele passou a
          gravar o arquivo na pasta de Fotos. */}
      <p className="mt-3 text-[12px] leading-relaxed text-texto-fraco">
        <strong className="font-semibold text-texto-suave">
          A arte só sobe pelo Conector.
        </strong>{' '}
        A API do Holyrics não recebe imagem de fora — quem resolve é o Conector,
        gravando o arquivo na pasta de Fotos dele antes de mandar exibir. Com o
        Conector rodando, &ldquo;Projetar a arte agora&rdquo; funciona sozinho;
        sem ele, só o texto vai.
      </p>
    </aside>
  );
}

function Passo({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-bold"
        style={{
          background: 'var(--acento-suave-fundo)',
          color: 'var(--acento-texto-sobre-fundo)',
        }}
      >
        {numero}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-texto">{titulo}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-texto-suave">
          {children}
        </p>
      </div>
    </li>
  );
}

/** Um caminho de menu dentro do Holyrics. */
function Caminho({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-semibold whitespace-nowrap text-texto">{children}</span>
  );
}
