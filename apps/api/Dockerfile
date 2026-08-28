FROM node:24-alpine

# Native build deps for argon2 (Argon2id hashing) and sharp (avatar/attachment
# thumbnails) - both compile a native addon on install.
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Root manifest first, and NOT overwritten by a later copy to the same path:
# its `workspaces` field is what makes `contracts` in apps/api/package.json
# resolve to packages/contracts (a symlink npm creates on install) instead of
# silently fetching an unrelated third-party package of the same name from
# the public registry.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN npm install

COPY packages/contracts packages/contracts
COPY apps/api apps/api

WORKDIR /app/apps/api

RUN npx prisma generate

RUN mkdir -p /var/lib/helpdesk/uploads

#EXPOSE 5000

#CMD ["npm", "run", "dev"]
# Generate the client and apply committed migrations before serving traffic so
# a fresh named volume is usable without a manual database intervention.
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npm run dev"]
