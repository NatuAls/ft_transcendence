FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

COPY tsconfig.base.json ./

COPY apps/web/package*.json ./

# ui es un paquete local del monorepo y debe existir antes de npm install.
#COPY ../../packages/ ./packages
COPY /packages/ ./packages/
RUN npm install

COPY apps/web/ ./

#EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]  
#CMD ["npm", "run", "dev", "--workspace=apps/web", "--", "--host", "0.0.0.0"]
