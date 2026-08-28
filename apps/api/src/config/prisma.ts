// Importamos el cliente generado por Prisma en la ruta definida en schema.prisma.
// Docker ejecuta TypeScript directamente con Node durante el desarrollo.
// TypeScript convertirá esta extensión a .js cuando se haga el build.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

// Prisma 7 requires a PostgreSQL driver adapter.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

// Reutilizamos la instancia durante el desarrollo para que el hot reload no
// cree varios clientes ni abra más conexiones de las necesarias.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Creamos el cliente una sola vez y lo exportamos para que el resto de la API
// pueda reutilizar esta misma instancia cuando empiece a hacer consultas.
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

// En producción no guardamos referencias globales innecesarias; en desarrollo
// sí conservamos la instancia para sobrevivir a las recargas del servidor.
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
