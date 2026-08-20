import { TelaAoVivo } from './TelaAoVivo';

/**
 * Ao Vivo — apoio a quem opera a transmissão no YouTube e no Instagram.
 *
 * Aparece no menu para todo mundo logado, e não só para quem cadastra:
 * copiar é o uso principal da tela e é leitura pura, então quem só opera a
 * live chega aqui pelo menu como qualquer outro. O bloco de cadastro é que
 * some para quem não tem `live:escrever` — ver `TelaAoVivo`.
 */
export default function PaginaAoVivo() {
  return <TelaAoVivo />;
}
