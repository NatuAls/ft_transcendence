// =============================================================================
//  Registro de métricas en formato Prometheus — SIN dependencias nuevas
//
//  Se ha escrito a mano en vez de añadir `prom-client` por dos razones
//  concretas de este proyecto:
//
//    1. `npm audit --audit-level=critical` es una puerta de CI que bloquea.
//       Cada dependencia nueva es superficie de cadena de suministro; para
//       cuatro contadores y un histograma no compensa.
//    2. Lo que se necesita es exactamente lo que pide la tarea 9 —CPU y
//       memoria del proceso, latencia, tasa de 5xx, colas y estado de las
//       dependencias—, y eso son 150 líneas.
//
//  Si el equipo prefiere `prom-client`, la sustitución es directa: los nombres
//  de métrica y las etiquetas de este fichero son los que usan las reglas de
//  config/prometheus/rules/alerts.yml y el panel de Grafana.
//
//  Cardinalidad: la etiqueta `route` usa SIEMPRE el patrón de Express
//  (`/tickets/:id`), nunca la URL concreta. Con 105 rutas y 5 familias de
//  código eso son ~500 series; usar la URL real haría crecer el índice sin
//  techo, que es la forma más habitual de tumbar un Prometheus.
// =============================================================================

type Labels = Record<string, string>;

function serializeLabels(labels: Labels): string {
  const entries = Object.entries(labels).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  return `{${entries
    .map(([k, v]) => `${k}="${String(v).replace(/(["\\])/g, '\\$1')}"`)
    .join(',')}}`;
}

// ------------------------------------------------------------------ contador --
class Counter {
  readonly name: string;
  readonly help: string;
  private readonly values = new Map<string, number>();
  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  inc(labels: Labels = {}, amount = 1): void {
    const key = serializeLabels(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + amount);
  }

  render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    for (const [labels, value] of this.values) {
      lines.push(`${this.name}${labels} ${value}`);
    }
    return lines.join('\n');
  }
}

// -------------------------------------------------------------------- gauge --
class Gauge {
  readonly name: string;
  readonly help: string;
  private readonly values = new Map<string, number>();
  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  set(labels: Labels, value: number): void {
    this.values.set(serializeLabels(labels), value);
  }

  render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
    ];
    for (const [labels, value] of this.values) {
      lines.push(`${this.name}${labels} ${value}`);
    }
    return lines.join('\n');
  }
}

// ---------------------------------------------------------------- histograma --
/**
 * Cubos pensados para una API web detrás de un proxy: la mayoría de las
 * peticiones caen por debajo de 250 ms y lo que interesa distinguir es el
 * "lento pero vivo" (0,5–2 s) del "esto va a dar timeout" (> 5 s).
 */
const DEFAULT_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

class Histogram {
  private readonly buckets = new Map<string, number[]>();
  private readonly sums = new Map<string, number>();
  private readonly counts = new Map<string, number>();
  readonly name: string;
  readonly help: string;
  readonly bounds: number[];

  constructor(name: string, help: string, bounds: number[] = DEFAULT_BUCKETS) {
    this.name = name;
    this.help = help;
    this.bounds = bounds;
  }

  observe(labels: Labels, seconds: number): void {
    const key = serializeLabels(labels);
    let counts = this.buckets.get(key);
    if (!counts) {
      counts = new Array<number>(this.bounds.length).fill(0);
      this.buckets.set(key, counts);
    }
    for (let i = 0; i < this.bounds.length; i += 1) {
      if (seconds <= this.bounds[i]!) counts[i] = (counts[i] ?? 0) + 1;
    }
    this.sums.set(key, (this.sums.get(key) ?? 0) + seconds);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];
    for (const [labels, counts] of this.buckets) {
      const inner = labels.slice(1, -1); // quita las llaves
      for (let i = 0; i < this.bounds.length; i += 1) {
        const le = `le="${this.bounds[i]}"`;
        lines.push(
          `${this.name}_bucket{${inner ? `${inner},` : ''}${le}} ${counts[i] ?? 0}`,
        );
      }
      lines.push(
        `${this.name}_bucket{${inner ? `${inner},` : ''}le="+Inf"} ${this.counts.get(labels) ?? 0}`,
      );
      lines.push(`${this.name}_sum${labels} ${this.sums.get(labels) ?? 0}`);
      lines.push(`${this.name}_count${labels} ${this.counts.get(labels) ?? 0}`);
    }
    return lines.join('\n');
  }
}

// ----------------------------------------------------------------- registro --
export const httpRequests = new Counter(
  'helpdesk_http_requests_total',
  'Peticiones HTTP atendidas, por método, ruta y familia de código.',
);

export const httpDuration = new Histogram(
  'helpdesk_http_request_duration_seconds',
  'Duración de las peticiones HTTP en segundos.',
);

export const httpInFlight = new Gauge(
  'helpdesk_http_requests_in_flight',
  'Peticiones HTTP en curso ahora mismo.',
);

export const rateLimitBlocked = new Counter(
  'helpdesk_rate_limit_blocked_total',
  'Peticiones rechazadas por rate limiting, por cubo.',
);

export const authFailures = new Counter(
  'helpdesk_auth_failures_total',
  'Intentos de autenticación fallidos, por motivo.',
);

export const dependencyUp = new Gauge(
  'helpdesk_dependency_up',
  'Estado de cada dependencia (1 arriba, 0,5 degradada, 0 caída).',
);

export const dependencyLatency = new Gauge(
  'helpdesk_dependency_latency_seconds',
  'Latencia de la última sonda de cada dependencia.',
);

export const realtimeConnections = new Gauge(
  'helpdesk_realtime_connections',
  'Sockets de tiempo real conectados.',
);

export const domainEvents = new Counter(
  'helpdesk_domain_events_total',
  'Eventos de dominio emitidos, por tipo. Sirve de proxy de la cola de trabajo.',
);

const COLLECTORS = [
  httpRequests,
  httpDuration,
  httpInFlight,
  rateLimitBlocked,
  authFailures,
  dependencyUp,
  dependencyLatency,
  realtimeConnections,
  domainEvents,
];

/** Métricas del proceso: memoria, CPU y uptime, sin dependencias externas. */
function processMetrics(): string {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  return [
    '# HELP helpdesk_process_resident_memory_bytes Memoria residente del proceso.',
    '# TYPE helpdesk_process_resident_memory_bytes gauge',
    `helpdesk_process_resident_memory_bytes ${mem.rss}`,
    '# HELP helpdesk_process_heap_used_bytes Heap de V8 en uso.',
    '# TYPE helpdesk_process_heap_used_bytes gauge',
    `helpdesk_process_heap_used_bytes ${mem.heapUsed}`,
    '# HELP helpdesk_process_cpu_seconds_total Tiempo de CPU consumido.',
    '# TYPE helpdesk_process_cpu_seconds_total counter',
    `helpdesk_process_cpu_seconds_total ${(cpu.user + cpu.system) / 1e6}`,
    '# HELP helpdesk_process_uptime_seconds Segundos desde el arranque.',
    '# TYPE helpdesk_process_uptime_seconds gauge',
    `helpdesk_process_uptime_seconds ${Math.floor(process.uptime())}`,
    '# HELP helpdesk_process_event_loop_lag_seconds Retraso del bucle de eventos.',
    '# TYPE helpdesk_process_event_loop_lag_seconds gauge',
    `helpdesk_process_event_loop_lag_seconds ${lastEventLoopLag.toFixed(6)}`,
  ].join('\n');
}

/**
 * Retraso del bucle de eventos: la métrica que de verdad avisa de que Node se
 * está ahogando (una consulta pesada, un `sharp` sin await) antes de que la
 * latencia HTTP suba.
 */
let lastEventLoopLag = 0;
const LAG_INTERVAL_MS = 5000;
const lagTimer = setInterval(() => {
  const started = process.hrtime.bigint();
  setImmediate(() => {
    lastEventLoopLag =
      Number(process.hrtime.bigint() - started) / 1e9 - 0; /* inmediato */
  });
}, LAG_INTERVAL_MS);
// No debe mantener vivo el proceso al cerrar.
lagTimer.unref();

export function renderMetrics(): string {
  return `${[processMetrics(), ...COLLECTORS.map((c) => c.render())].join('\n')}\n`;
}
