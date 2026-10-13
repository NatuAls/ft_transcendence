// ============================================================================
//  PRUEBAS DE LA PANTALLA: CreateTicketPage
// ============================================================================
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../src/core/feedback/ToastProvider';
import { initI18n } from '../src/core/i18n';
import { CreateTicketPage } from '../src/features/tickets/CreateTicketPage';
import { mockApi } from './support/api';

// ------------------------------------------------------------ fixtures --
const ORG_ID = '01a10712-4c1e-7b3d-a0f2-9be1d07c5a11';
const ORG_NAME = 'Northstar Team';
const CATEGORY_ID = '01a10712-4c1e-7b3d-a0f2-9be1d07c5a12';

const category = (id: string, name: string, description: string = '') => ({
  id,
  name,
  description,
  color: '#000000',
  isActive: true,
  _count: { tickets: 0 },
});

const failure = (status: number, code: string, messageKey: string) => ({
  status,
  body: { code, message: code, messageKey, statusCode: status },
});

beforeAll(async () => {
  await initI18n();
});

// Envolvemos el renderizado con el ToastProvider para que no falle el useToast
function renderCreatePage(
  overrides: Partial<React.ComponentProps<typeof CreateTicketPage>> = {},
) {
  const defaultProps = {
    onCancel: vi.fn(),
    onCreated: vi.fn(),
    organizationName: ORG_NAME,
    organizationId: ORG_ID,
  };

  return render(
    <ToastProvider>
      <CreateTicketPage {...defaultProps} {...overrides} />
    </ToastProvider>,
  );
}

// -------------------------------------------------------------- pruebas --
describe('tickets · nueva creación', () => {
  it('carga las categorías reales de la organización', async () => {
    // Simulamos la respuesta de las categorías (GET)
    const { calls } = mockApi({
      [`GET /organizations/${ORG_ID}/categories`]: {
        status: 200,
        body: [category('cat-1', 'Facturación')],
      },
    });

    renderCreatePage();

    // Verificamos que se pintó el título de la página
    expect(await screen.findByText('Create a ticket')).toBeTruthy();
    // Verificamos que cargó la categoría en el select
    expect(await screen.findByText('Facturación')).toBeTruthy();

    // Verificamos que pidió las categorías a la URL correcta
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.path).toBe(`/organizations/${ORG_ID}/categories`);
  });

  it('no ofrece una categoría desactivada: el ticket no podría encaminarse', async () => {
    mockApi({
      [`GET /organizations/${ORG_ID}/categories`]: {
        status: 200,
        body: [
          category('cat-1', 'Facturación'),
          { ...category('cat-2', 'Antigua'), isActive: false },
        ],
      },
    });

    renderCreatePage();

    expect(await screen.findByText('Facturación')).toBeTruthy();
    expect(screen.queryByText('Antigua')).toBeNull();
  });

  it('enseña la organización y no deja cambiarla: es de sólo lectura', async () => {
    mockApi({
      [`GET /organizations/${ORG_ID}/categories`]: {
        status: 200,
        body: [category('cat-1', 'Facturación')],
      },
    });

    renderCreatePage();

    // Se ve a qué organización va el ticket, igual que la dirección de correo
    // en el diálogo de usuarios de la plataforma, y por el mismo motivo: es un
    // dato del contexto, no algo que se elija aquí.
    const campo = (await screen.findByDisplayValue(
      ORG_NAME,
    )) as HTMLInputElement;
    expect(campo.disabled).toBe(true);
  });

  it('sin categorías activas, permite dejar la categoría sin asignar', async () => {
    mockApi({
      [`GET /organizations/${ORG_ID}/categories`]: { status: 200, body: [] },
    });

    renderCreatePage();

    const desplegable = (await screen.findByRole(
      'combobox',
    )) as HTMLSelectElement;
    expect(desplegable.value).toBe('');
    expect(
      screen.getByRole('option', { name: 'Select a category (optional)...' }),
    ).toBeTruthy();
  });

  it('error al cargar categorías: lo dice y deja reintentar', async () => {
    let call = 0;
    mockApi({
      [`GET /organizations/${ORG_ID}/categories`]: () =>
        ++call === 1
          ? failure(500, 'INTERNAL_ERROR', 'errors.common.unexpected')
          : { status: 200, body: [category('cat-1', 'Recuperado')] },
    });

    renderCreatePage();

    // Vemos el error traducido en el componente AsyncState
    expect(
      await screen.findByText('Unexpected error. Please try again.'),
    ).toBeTruthy();

    // Hacemos click en reintentar
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    // Verificamos que cargó bien la segunda vez
    expect(await screen.findByText('Recuperado')).toBeTruthy();
  });

  it('valida el formulario localmente antes de enviar', async () => {
    const { calls } = mockApi({
      [`GET /organizations/${ORG_ID}/categories`]: {
        status: 200,
        body: [category(CATEGORY_ID, 'General')],
      },
      ['POST /tickets']: { status: 201, body: {} },
    });

    renderCreatePage();
    await screen.findByText('General');

    // Hacemos click en enviar SIN RELLENAR los campos (asunto y descripción)
    fireEvent.submit(
      screen.getByRole('button', { name: 'Create ticket' }).closest('form')!,
    );

    // Verificamos que se pintaron los mensajes de error bajo los campos
    // (Asegúrate de que 'Check this field.' es lo que devuelve errors.ts actualmente)
    const errorMessages = await screen.findAllByText('Check this field.');
    expect(errorMessages.length).toBeGreaterThan(0);

    // Comprobamos que NUNCA salió la petición POST
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('envío correcto: manda los datos correctos a la API y avisa del éxito', async () => {
    const onCreatedMock = vi.fn();
    const { calls } = mockApi({
      [`GET /organizations/${ORG_ID}/categories`]: {
        status: 200,
        body: [category(CATEGORY_ID, 'General')],
      },
      ['POST /tickets']: {
        status: 201,
        body: { id: 'ticket-1' }, // La respuesta real del backend
      },
    });

    renderCreatePage({ onCreated: onCreatedMock });
    await screen.findByText('General');

    // Rellenamos el formulario
    fireEvent.change(screen.getByLabelText('Subject *'), {
      target: { value: 'Mi nuevo problema' },
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: CATEGORY_ID },
    });

    // Encontrar el textarea por rol suele ser más fiable en Testing Library si falla el LabelText
    const textarea = screen.getByPlaceholderText(
      'Explain what happened, what you expected and any steps that reproduce the problem.',
    );
    fireEvent.change(textarea, {
      target: { value: 'Esta descripción tiene más de diez caracteres' },
    });

    // Enviamos
    fireEvent.click(screen.getByRole('button', { name: 'Create ticket' }));

    // Esperamos a que salga la petición POST
    await waitFor(() =>
      expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1),
    );

    // Validamos que se envió exactamente lo que esperaba la API
    const postCall = calls.find((call) => call.method === 'POST')!;
    expect(postCall.body).toEqual({
      organizationId: ORG_ID,
      title: 'Mi nuevo problema',
      description: 'Esta descripción tiene más de diez caracteres',
      priority: 'MEDIUM', // El default que pusimos
      categoryId: CATEGORY_ID,
    });

    // Validamos que se llamó a la función para cerrar la pantalla
    expect(onCreatedMock).toHaveBeenCalledTimes(1);

    // Validamos que se pintó el Toast de éxito
    expect(
      await screen.findByText('Ticket created successfully.'),
    ).toBeTruthy();
  });

  it('rechazo de la API: muestra el error sin cerrar la pantalla', async () => {
    const { calls } = mockApi({
      [`GET /organizations/${ORG_ID}/categories`]: {
        status: 200,
        body: [category(CATEGORY_ID, 'General')],
      },
      // Simulamos que el backend rechaza la creación
      ['POST /tickets']: failure(
        500,
        'SERVER_ERROR',
        'errors.common.unexpected',
      ),
    });

    renderCreatePage();
    await screen.findByText('General');

    // Rellenamos datos válidos
    fireEvent.change(screen.getByLabelText('Subject *'), {
      target: { value: 'Mi nuevo problema' },
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: CATEGORY_ID },
    });
    const textarea = screen.getByPlaceholderText(
      'Explain what happened, what you expected and any steps that reproduce the problem.',
    );
    fireEvent.change(textarea, {
      target: { value: 'Esta descripción tiene más de diez caracteres' },
    });

    // Enviamos
    fireEvent.click(screen.getByRole('button', { name: 'Create ticket' }));

    // Verificamos que salió la petición
    await waitFor(() =>
      expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1),
    );

    // Comprobamos que el error general se pintó en la pantalla
    // (Es un <Alert role="alert"> en la UI)
    const alertBox = await screen.findByRole('alert');
    expect(alertBox).toBeTruthy();
    expect(alertBox.textContent).toContain(
      'Unexpected error. Please try again.',
    );

    // El texto introducido sigue ahí (no se ha limpiado el formulario)
    expect((screen.getByLabelText('Subject *') as HTMLInputElement).value).toBe(
      'Mi nuevo problema',
    );
  });
});
