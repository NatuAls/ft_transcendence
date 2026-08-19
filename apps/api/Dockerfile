FROM node:24-alpine

WORKDIR /app

COPY apps/api/package*.json ./

COPY /packages/ ./packages/

RUN npm install

COPY apps/api/prisma ./prisma

RUN npx prisma generate

COPY apps/api/ .	

#EXPOSE 5000

CMD ["npm", "run", "dev"]
