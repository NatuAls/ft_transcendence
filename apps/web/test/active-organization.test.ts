import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetOrganization,
  rememberedOrganization,
  rememberOrganization,
} from '../src/app/activeOrganization';

/**
 * La organización en la que estabas sobrevive a una recarga.
 *
 * El síntoma del 08/10: F5 te devolvía a la primera organización de la lista,
 * y lo desconcertante era que ir a la administración de la plataforma y volver
 * SÍ conservaba la elegida —porque ahí no se remonta el armazón—, así que la
 * aplicación parecía recordar a ratos.
 */
const VILANOVA = '01a1131b-d3f6-748a-9add-5a62196be5ed';
const CONSELL = '01a1131c-0c9e-718d-bd7b-b19c5541de49';
const YO = 'usuario-1';
const OTRA_PERSONA = 'usuario-2';

describe('la organización activa que se recuerda', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('no inventa nada cuando no se ha guardado nunca', () => {
    expect(rememberedOrganization(YO)).toBeUndefined();
  });

  it('devuelve la última en la que estuviste', () => {
    rememberOrganization(YO, VILANOVA);
    rememberOrganization(YO, CONSELL);
    expect(rememberedOrganization(YO)).toBe(CONSELL);
  });

  it('no mezcla a dos personas del mismo navegador', () => {
    rememberOrganization(YO, VILANOVA);
    rememberOrganization(OTRA_PERSONA, CONSELL);
    expect(rememberedOrganization(YO)).toBe(VILANOVA);
    expect(rememberedOrganization(OTRA_PERSONA)).toBe(CONSELL);
  });

  it('al cerrar sesión se olvida la tuya y se respeta la de los demás', () => {
    rememberOrganization(YO, VILANOVA);
    rememberOrganization(OTRA_PERSONA, CONSELL);
    forgetOrganization(YO);
    expect(rememberedOrganization(YO)).toBeUndefined();
    expect(rememberedOrganization(OTRA_PERSONA)).toBe(CONSELL);
  });

  it('un almacenamiento con basura no rompe la aplicación', () => {
    localStorage.setItem('helpdesk.activeOrganization', 'esto no es JSON');
    expect(rememberedOrganization(YO)).toBeUndefined();
    rememberOrganization(YO, VILANOVA);
    expect(rememberedOrganization(YO)).toBe(VILANOVA);
  });

  it('ignora lo que no viene con identificadores', () => {
    rememberOrganization('', VILANOVA);
    rememberOrganization(YO, '');
    expect(rememberedOrganization(YO)).toBeUndefined();
  });
});
