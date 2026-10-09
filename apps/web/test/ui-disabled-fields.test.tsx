import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SelectField, TextField } from 'ui';

/**
 * Un campo apagado tiene que estar apagado de verdad.
 *
 * `SelectField` extrae `disabled` de sus props para atenuar también la
 * etiqueta, y al hacerlo dejó de reenviarlo al `<select>`: el campo se veía
 * apagado y seguía siendo pulsable. No es cosmético — de ese atributo cuelgan
 * tres protecciones reales:
 *
 *   · el rol de plataforma del administrador principal y el tuyo propio,
 *   · el estado de esas mismas cuentas,
 *   · tu propio rol dentro de una organización.
 *
 * La API las rechaza igualmente, así que no se podía romper nada de verdad,
 * pero la pantalla ofrecía lo que luego iba a negar. `TextField` sí lo hacía
 * bien; se comprueban los dos para que no se separen otra vez.
 */
describe('los campos deshabilitados de la biblioteca', () => {
  it('SelectField apaga el control, no sólo su aspecto', () => {
    render(
      <SelectField disabled label="Platform access">
        <option>Standard user</option>
        <option>Global admin</option>
      </SelectField>,
    );
    const control = screen.getByRole('combobox', {
      name: 'Platform access',
    }) as HTMLSelectElement;
    expect(control.disabled).toBe(true);
  });

  it('y lo deja utilizable cuando no se le pide lo contrario', () => {
    render(
      <SelectField label="Organization role">
        <option>Member</option>
      </SelectField>,
    );
    const control = screen.getByRole('combobox', {
      name: 'Organization role',
    }) as HTMLSelectElement;
    expect(control.disabled).toBe(false);
  });

  it('TextField hace lo mismo', () => {
    render(<TextField disabled label="Email address" value="a@b.test" />);
    const control = screen.getByLabelText('Email address') as HTMLInputElement;
    expect(control.disabled).toBe(true);
  });
});
