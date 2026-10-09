/**
 * La organización en la que estabas, recordada entre recargas.
 *
 * Sin esto, F5 te devolvía a la primera organización de la lista: el estado
 * del armazón se pierde al recargar y la sesión volvía a elegir por omisión.
 * Lo raro era que navegar a la administración de la plataforma y volver SÍ
 * conservaba la elegida —porque ahí no se remonta nada—, así que la aplicación
 * parecía recordar a ratos.
 *
 * Va en `localStorage` y no en la URL a propósito: no es un filtro de una
 * pantalla (que sí van en la URL, R2) sino en cuál de tus organizaciones estás
 * trabajando, y tiene que sobrevivir a cualquier ruta. Se guarda POR PERSONA:
 * dos cuentas en el mismo navegador no heredan la elección de la otra.
 *
 * Es una comodidad, no una fuente de verdad: si la organización guardada ya no
 * está entre las tuyas, quien elige vuelve a ser la sesión.
 */
const CLAVE = 'helpdesk.activeOrganization';

type Guardado = Record<string, string>;

function leerTodo(): Guardado {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return {};
    const valor: unknown = JSON.parse(crudo);
    return valor && typeof valor === 'object' ? (valor as Guardado) : {};
  } catch {
    // Modo privado, almacenamiento bloqueado o un valor que no es JSON.
    return {};
  }
}

/** La última organización de esta persona, si la hay. */
export function rememberedOrganization(userId: string): string | undefined {
  return leerTodo()[userId];
}

export function rememberOrganization(userId: string, organizationId: string) {
  if (!userId || !organizationId) return;
  try {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({ ...leerTodo(), [userId]: organizationId }),
    );
  } catch {
    /* modo privado */
  }
}

/** Al cerrar sesión: lo que recordaba esta persona deja de aplicar. */
export function forgetOrganization(userId: string) {
  if (!userId) return;
  try {
    const todo = leerTodo();
    delete todo[userId];
    localStorage.setItem(CLAVE, JSON.stringify(todo));
  } catch {
    /* modo privado */
  }
}
