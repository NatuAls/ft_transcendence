// =============================================================================
//  Middleware de métricas HTTP
//
//  Se monta MUY pronto (justo después de requestContext) para que mida también
//  las peticiones que mueren en el parser de JSON o en el rate limit, que son
//  precisamente las que interesan cuando algo va mal.
//
//  En apps/api/src/app.ts:
//      import { httpMetrics } from './common/middleware/http-metrics.ts';
//      app.use(requestContext);
//      app.use(httpMetrics);        // <-- aquí
//
//  CARDINALIDAD. `route` es el patrón de Express (`/tickets/:id`), no la URL.
//  Cuando Express no ha resuelto ninguna ruta (404, o error antes del
//  enrutado) se etiqueta como `unmatched`: una sola serie en vez de una por
//  cada URL que pruebe un escáner de vulnerabilidades, que es como se llena un
//  Prometheus en una tarde.
// =============================================================================
import type { NextFunction, Request, Response } from 'express';
import {
  httpRequests,
  httpDuration,
  httpInFlight,
} from '../../modules/observability/metrics.ts';

let inFlight = 0;

/** `/api/v1` + patrón del router, o `unmatched` si no se resolvió ninguno. */
function routeLabel(req: Request): string {
  const base = (req.baseUrl ?? '').replace(/\/$/, '');
  const pattern = req.route?.path;
  if (typeof pattern === 'string') {
    return `${base}${pattern === '/' ? '' : pattern}` || '/';
  }
  // Sondas y raíz: son rutas fijas y conocidas, no hay riesgo de cardinalidad.
  if (/^\/api\/(health|version|metrics)/.test(req.path)) return req.path;
  return 'unmatched';
}

export function httpMetrics(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const started = process.hrtime.bigint();
  inFlight += 1;
  httpInFlight.set({}, inFlight);

  res.on('finish', () => {
    inFlight -= 1;
    httpInFlight.set({}, inFlight);

    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    const labels = {
      method: req.method,
      route: routeLabel(req),
      // Familia de código, no el código exacto: `5xx` es lo que consultan las
      // alertas, y agrupar divide por cinco el número de series.
      status: `${Math.floor(res.statusCode / 100)}xx`,
    };
    httpRequests.inc(labels);
    httpDuration.observe(labels, seconds);
  });

  next();
}
