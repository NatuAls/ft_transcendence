import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import i18next from 'i18next';
import { setLanguage } from '../src/core/i18n';
import {
  applyTheme,
  chooseTheme,
  followThemeOfOtherTabs,
} from '../src/core/theme';

/**
 * Lo que se elige en una pestaña llega a las demás del mismo navegador.
 *
 * El síntoma del 15/10: con *Members* en una pestaña y *Preferences* en otra,
 * cambiar el idioma sólo cambiaba la segunda; la primera seguía en el idioma
 * anterior hasta recargar. El navegador avisa a las DEMÁS pestañas con el
 * evento `storage` cuando una escribe en `localStorage`; aquí se simula ese
 * aviso, que es lo que recibe la otra pestaña.
 */
function avisoDeOtraPestana(key: string, newValue: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
}

afterEach(async () => {
  await act(async () => {
    await i18next.changeLanguage('en');
  });
  localStorage.clear();
});

describe('el idioma, entre pestañas', () => {
  it('se cambia en ésta cuando otra pestaña lo elige', async () => {
    avisoDeOtraPestana('hd_lang', 'ca');
    await vi.waitFor(() => expect(i18next.language).toBe('ca'));
    expect(document.documentElement.lang).toBe('ca');
  });

  it('no hace caso de lo que no es un idioma suyo ni de otras claves', async () => {
    avisoDeOtraPestana('hd_lang', 'xx');
    avisoDeOtraPestana('otra_cosa', 'es');
    avisoDeOtraPestana('hd_lang', null);
    await new Promise((listo) => setTimeout(listo, 0));
    expect(i18next.language).toBe('en');
  });

  it('elegirlo aquí lo deja escrito para que lo vean las demás', async () => {
    await act(async () => {
      await setLanguage('es');
    });
    expect(localStorage.getItem('hd_lang')).toBe('es');
  });
});

describe('el tema, entre pestañas', () => {
  it('se aplica en ésta cuando otra pestaña lo elige', () => {
    followThemeOfOtherTabs();
    applyTheme('light');
    avisoDeOtraPestana('hd_theme', 'dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    avisoDeOtraPestana('hd_theme', 'no-es-un-tema');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('sólo se comparte lo que se elige: el de carga se queda en su pestaña', () => {
    chooseTheme('light');
    expect(localStorage.getItem('hd_theme')).toBe('light');
    // Abrir una pestaña aplica el tema de la API con applyTheme: si lo
    // compartiese, cambiaría el de las pestañas que ya estaban abiertas.
    applyTheme('dark');
    expect(localStorage.getItem('hd_theme')).toBe('light');
  });
});
