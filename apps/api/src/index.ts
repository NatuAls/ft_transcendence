import express, { type Express, type Request, type Response } from 'express';

// Prueba de importación: verifica que la instancia singleton se puede cargar.
// Todavía no hacemos consultas ni usamos Prisma contra la base de datos.
import { prisma } from './config/prisma.js';

// Evitamos que esta prueba de importación sea considerada una variable sin uso
// hasta que los servicios empiecen a utilizar el cliente de Prisma.
void prisma;

const app: Express = express();

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

// Backend fix: Docker publica el puerto 5000; usamos PORT y escuchamos en todas las interfaces del contenedor.
//app.listen(3000);
const port = Number(process.env.PORT ?? 5000);
app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on port ${port}`);
});
