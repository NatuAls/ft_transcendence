FROM node:24-alpine

WORKDIR /app

COPY apps/api/package*.json ./

COPY /packages/ ./packages/

RUN npm install

COPY apps/api/prisma ./prisma

# Copiamos el código antes de generar Prisma para que la salida generada no
# sea reemplazada al copiar la carpeta src/ después.
COPY apps/api/ .

# Genera el cliente en /app/src/generated/prisma, según schema.prisma.
RUN npx prisma generate

#EXPOSE 5000

CMD ["npm", "run", "dev"]
