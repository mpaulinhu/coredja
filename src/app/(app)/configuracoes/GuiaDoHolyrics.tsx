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

      <ul className="mt-4 flex flex-col gap-2 border-t border-borda pt-4">
        {ACOES_DO_HOLYRICS.map((item) => (
          <li key={item.acao}>
            <code className="font-mono text-[12px] font-semibold text-texto">
              {item.acao}
            </code>
            <p className="text-[12px] leading-snug text-texto-fraco">
              {item.paraQue}
            </p>
          </li>
        ))}
      </ul>

      {/* Esta é a limitação que mais custa tempo de quem instala: tudo
          configurado, tudo testado, e não funciona porque o servidor está
          fora da rede da igreja. Aparece aqui em vez de só no código. */}
      <div
        className="mt-4 rounded-lg border px-3 py-2.5"
        style={{
          borderColor: 'var(--alerta)',
          background: 'var(--alerta-fundo)',
        }}
      >
        <p className="text-[12px] font-bold" style={{ color: 'var(--alerta)' }}>
          O Coredja precisa estar na mesma rede do Holyrics
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-texto-suave">
          Quem fala com o Holyrics é o servidor do Coredja, não o navegador —
          é assim que o token nunca chega ao seu computador. O efeito colateral:
          hospedado na internet, o servidor não alcança um endereço{' '}
          <code className="font-mono">192.168.x.x</code> da igreja, e o teste
          sempre vai dar tempo esgotado. Rodando na máquina do audiovisual, ou
          em outra da mesma rede, funciona.
        </p>
      </div>

      {/* Falado explicitamente porque a expectativa natural é que "projetar o
          aviso" inclua a arte — e descobrir isso ao vivo, no domingo, é o
          pior momento possível. */}
      <p className="mt-3 text-[12px] leading-relaxed text-texto-fraco">
        <strong className="font-semibold text-texto-suave">
          Imagem não vai automático.
        </strong>{' '}
        A API do Holyrics só exibe artes que já estão na aba de arquivos dele —
        não existe envio de imagem de fora. Avisos com arte precisam ser
        projetados à mão; o texto vai normalmente.
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
