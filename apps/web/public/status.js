// =============================================================================
//  Página de estado — lógica
//
//  Lee el semáforo público de GET /api/health/status y lo pinta. Nada más:
//  ni dependencias, ni bundler, ni sesión. Va en un fichero aparte porque la
//  CSP del contenedor `web` es `script-src 'self'` y no admite JavaScript en
//  línea.
//
//  Contrato que consume (apps/api/src/modules/health/health.router.ts):
//
//      { "overall": "operational" | "degraded" | "major_outage",
//        "areas":   [ { "area": "tickets", "status": "operativo" }, … ],
//        "checkedAt": "2026-10-04T10:12:00.000Z" }
//
//  Dos decisiones que importan:
//
//    1. Si la API no contesta, la página NO se queda en blanco ni girando:
//       pinta "Cannot reach the service" y deja las áreas en Unknown. Es el
//       caso para el que existe una página de estado.
//    2. Las etiquetas de las áreas se traducen con una tabla, pero un nombre
//       que no esté en la tabla NO se descarta: se muestra con el texto
//       embellecido. Así, si mañana la API añade un área, la página la
//       enseña en lugar de ocultarla.
// =============================================================================

/** Nombres técnicos de la API -> lo que lee el usuario. */
const AREA_LABELS = {
  autenticacion: 'Sign in and accounts',
  tickets: 'Tickets',
  adjuntos: 'Attachments',
  tiempo_real: 'Chat and real time',
  notificaciones_por_correo: 'E-mail notifications',
};

/** Estados de área -> texto de la pastilla. */
const AREA_STATES = {
  operativo: 'Operational',
  rendimiento_reducido: 'Reduced performance',
  no_disponible: 'Not available',
};

/** Estado global -> titular. */
const HEADLINES = {
  operational: 'All systems operational',
  degraded: 'Some areas are running slower than usual',
  major_outage: 'Part of the service is unavailable',
};

const summary = document.getElementById('summary');
const headline = document.getElementById('headline');
const checked = document.getElementById('checked');
const list = document.getElementById('areas');
const notice = document.getElementById('notice');
const refresh = document.getElementById('refresh');

/** `tiempo_real` -> `Tiempo real`, para un área que no esté en la tabla. */
function prettify(name) {
  const text = String(name).replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function showNotice(text) {
  if (!text) {
    notice.hidden = true;
    notice.textContent = '';
    return;
  }
  notice.textContent = text;
  notice.hidden = false;
}

function renderAreas(areas) {
  list.replaceChildren(
    ...areas.map(({ area, status }) => {
      const row = document.createElement('li');
      row.append(AREA_LABELS[area] ?? prettify(area));

      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.dataset.state = status in AREA_STATES ? status : 'unknown';
      pill.textContent = AREA_STATES[status] ?? prettify(status);
      row.append(pill);

      return row;
    }),
  );
}

/** Deja cada fila existente en Unknown, sin tocar las etiquetas. */
function blankAreas() {
  for (const pill of list.querySelectorAll('.pill')) {
    pill.dataset.state = 'unknown';
    pill.textContent = 'Unknown';
  }
}

function formatTime(iso) {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

async function load() {
  refresh.disabled = true;
  // Un AbortController en lugar de confiar en el tiempo de espera del
  // navegador: si la API acepta la conexión y no responde, la página tiene
  // que rendirse y decirlo, no quedarse esperando minutos.
  const timeout = AbortSignal.timeout(8000);

  try {
    const response = await fetch('/api/health/status', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: timeout,
    });

    // 429 incluido: el endpoint está limitado y conviene distinguirlo de una
    // caída, porque el servicio puede estar perfectamente bien.
    if (response.status === 429) {
      summary.dataset.state = 'loading';
      headline.textContent = 'Too many checks';
      checked.textContent = 'Wait a moment before checking again.';
      showNotice('');
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const state = data.overall in HEADLINES ? data.overall : 'degraded';

    summary.dataset.state = state;
    headline.textContent = HEADLINES[state];
    const time = formatTime(data.checkedAt);
    checked.textContent = time
      ? `Last checked at ${time}`
      : 'Last checked just now';

    if (Array.isArray(data.areas) && data.areas.length > 0) {
      renderAreas(data.areas);
    } else {
      blankAreas();
    }
    showNotice('');
  } catch (error) {
    // Sin detalle del error en pantalla: el mensaje de una excepción de red
    // puede llevar el nombre del host interno, y esta página es pública.
    summary.dataset.state = 'major_outage';
    headline.textContent = 'Cannot reach the service';
    checked.textContent = `Last attempt at ${formatTime(new Date().toISOString())}`;
    blankAreas();
    showNotice(
      'The status endpoint did not answer. The application is probably ' +
        'unavailable right now; this page will keep trying every 60 seconds.',
    );
  } finally {
    refresh.disabled = false;
  }
}

refresh.addEventListener('click', () => void load());

// 60 s es el mismo tiempo que la API cachea la respuesta pública: pedirlo más
// a menudo no daría datos más frescos y sí gastaría el límite de peticiones.
setInterval(() => void load(), 60_000);

// Al volver a la pestaña, un refresco inmediato: lo normal es dejar esta
// página abierta en segundo plano durante una incidencia.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void load();
});

void load();
