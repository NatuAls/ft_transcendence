// zod 4, al crear cada esquema de objeto, prueba `new Function('')` para ver
// si puede compilar validadores más rápidos. Nuestra CSP (`script-src 'self'`)
// lo prohíbe, como debe: zod captura el error y valida por el camino normal,
// pero Chrome anota el intento en cada carga como «Content Security Policy of
// your site blocks the use of `eval`». Con `jitless` ni lo intenta.
//
// La prueba se hace al construir los esquemas, es decir, al importar
// `contracts`, y no al validar: por eso este módulo es el primer import de
// main.tsx, antes que cualquier pantalla.
import { z } from 'zod';

z.config({ jitless: true });
