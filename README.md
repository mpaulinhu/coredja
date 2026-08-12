# Coredja

Plataforma de comunicação interna da igreja. A primeira tela conecta as áreas
(Cantina e Kids) ao audiovisual: elas mandam recados do celular, você recebe
num painel que atualiza sozinho.

---

## Como rodar

Na primeira vez, instale as dependências:

```bash
pnpm install
```

Para usar no domingo:

```bash
pnpm build
pnpm start
```

O `pnpm start` é a versão rápida, para uso real. O `pnpm dev` é para quando
estiver mexendo no código: ele recarrega sozinho a cada alteração, mas é mais
lento.

---

## Os endereços

Com o servidor rodando, abra `http://localhost:3000` para ver a lista de
links.

| Quem | Endereço |
|---|---|
| Audiovisual (você) | `/painel` |
| Cantina | `/a/cantina-TOKEN-REMOVIDO` |
| Kids | `/a/kids-TOKEN-REMOVIDO` |

### Nos celulares das áreas

Os celulares não conseguem abrir `localhost` — esse endereço significa "este
computador aqui". Eles precisam do número do seu PC na rede da igreja.

Para descobrir esse número, rode no PC do audiovisual:

```bash
ipconfig
```

Procure por "Endereço IPv4", algo como `192.168.0.15`. O link da Cantina fica
então:

```
http://192.168.0.15:3000/a/cantina-TOKEN-REMOVIDO
```

Abra esse link no celular da Cantina e mande salvar na tela inicial. Vira um
ícone, e a pessoa não precisa digitar nada de novo.

> **Se o número mudar.** Alguns roteadores trocam esse número de tempos em
> tempos, e aí o link salvo para de funcionar. Se isso acontecer, dá para
> fixar o número do PC nas configurações do roteador (procure por "IP fixo" ou
> "DHCP reservation"). Vale fazer isso uma vez e esquecer.

---

## Como funciona no domingo

**Nas áreas.** A pessoa abre o ícone, escreve o recado, e envia. Se for algo
que não pode esperar, aperta **Urgente** antes. Se tiver um banner, aperta
**Imagem** e escolhe do celular — até 4 imagens de 10 MB cada.

**No audiovisual.** O painel fica aberto no monitor lateral. Os recados
aparecem sozinhos, com os urgentes no topo e em vermelho. Toca um som quando
chega um novo — dois tons para normal, três mais agudos para urgente.

Cada recado tem **Marcar como resolvido**, que o tira da lista e manda para o
**Histórico**. Se clicar errado, o botão **Reabrir** no histórico devolve.

Para falar com uma área, use os botões **Falar com: Cantina / Kids** no rodapé.

**Os banners.** A imagem aparece no cartão com um link **Baixar** embaixo.
Você baixa e coloca no telão pelo Holyrics, como já faz hoje.

### O som

O navegador só libera som depois do primeiro clique na página. Ao abrir o
painel, clique uma vez em qualquer lugar — depois disso o alerta funciona pelo
resto do culto. O botão **Som ligado / Som desligado** no topo controla isso.

---

## O que precisa estar ligado

O PC do audiovisual é o servidor. Enquanto ele estiver ligado, com o `pnpm
start` rodando e conectado ao Wi-Fi da igreja, tudo funciona. Se ele dormir,
cair da rede ou desligar, os recados param de chegar.

Vale desativar a suspensão automática do Windows durante o culto.

---

## Os links secretos

Não há login: quem tem o link de uma área envia recados como aquela área.
É simples de usar e não atrapalha ninguém no meio do culto, mas significa
que um link vazado num grupo de WhatsApp deixa qualquer pessoa mandar recado
como se fosse a Cantina.

Para trocar um link, abra [`src/lib/areas.ts`](src/lib/areas.ts) e mude o
`token` da área. O link antigo para de funcionar assim que você reiniciar o
servidor. O histórico não se perde.

---

## Adicionar uma área nova

Abra [`src/lib/areas.ts`](src/lib/areas.ts) e acrescente um item à lista:

```ts
{
  slug: 'recepcao',
  nome: 'Recepção',
  token: 'k9m2p7',   // invente um trecho secreto qualquer
  cor: '#7c5cd6',    // cor de identificação no painel
}
```

Reinicie o servidor e a área nova aparece na home, no painel e nos botões de
"Falar com".

---

## Backup

Tudo — recados, histórico e imagens — vive na pasta `dados/`. Fazer backup é
copiar essa pasta. Restaurar é colocá-la de volta.

Ela não vai para o git de propósito: são as mensagens reais da igreja.

---

## O que vem depois

**Aviso por cima do Holyrics.** Uma janelinha pequena, sempre no topo do
monitor, que acende quando chega recado. É um programa à parte (Electron) e
não depende do Holyrics para funcionar.

**Integração com o Holyrics.** Mandar um recado ou um banner direto para o
telão, sem passar pelo download. O Holyrics tem uma API que roda na máquina
dele, então isso exige que a plataforma alcance essa máquina na rede da
igreja.

**Login.** Quando as áreas crescerem, os links secretos podem dar lugar a
contas de verdade. A estrutura já separa "qual é a área" de "como ela se
identifica", então essa troca não mexe nas telas.

---

## Estrutura do código

```
src/
├─ app/
│  ├─ a/[chave]/          Tela de envio das áreas (celular e PC)
│  ├─ painel/             Painel do audiovisual
│  ├─ api/
│  │  ├─ areas/           Envio e leitura dos recados de uma área
│  │  ├─ painel/          Dados do painel, respostas, resolver/reabrir
│  │  ├─ eventos/         Canal de tempo real (SSE)
│  │  └─ imagens/         Serve as imagens enviadas
│  └─ page.tsx            Home com a lista de links
├─ hooks/
│  ├─ useEventos.ts       Recebe os avisos de tempo real
│  └─ useAlertaSonoro.ts  Som de recado novo
└─ lib/
   ├─ types.ts            Contrato de dados (Area, Mensagem, Store)
   ├─ store.ts            Ponto único de troca do armazenamento
   ├─ sqlite-store.ts     Implementação atual (SQLite local)
   ├─ db.ts               Conexão e schema do banco
   ├─ areas.ts            As áreas da igreja e seus links
   ├─ uploads.ts          Validação e gravação das imagens
   ├─ limites.ts          Limites de tamanho, usados nos dois lados
   └─ eventos.ts          Publicação dos avisos de tempo real
```

### Sobre a migração para Firebase

Hoje os dados ficam no PC do audiovisual, num arquivo SQLite. Se um dia a
plataforma precisar ser acessada de fora da igreja, a troca para Firebase está
prevista: todo acesso a dados passa por [`src/lib/store.ts`](src/lib/store.ts),
que expõe a interface `Store` definida em
[`src/lib/types.ts`](src/lib/types.ts).

Migrar significa escrever um `firebase-store.ts` que satisfaça essa mesma
interface e trocar uma linha em `store.ts`. As telas não mudam.

Duas peças a mais fazem parte dessa migração: as imagens passam do disco para
o Firebase Storage (o campo `url` de cada anexo já é opaco para quem exibe), e
os avisos de tempo real de [`src/lib/eventos.ts`](src/lib/eventos.ts) dão lugar
aos listeners nativos do Firestore.
