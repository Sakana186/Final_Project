FROM node:22-trixie-slim AS node-runtime

FROM python:3.14-slim-trixie

WORKDIR /app

ENV LD_LIBRARY_PATH=/app/services/storage-service/python-vendor/native/linux-x86_64

COPY --from=node-runtime /usr/local/bin/ /usr/local/bin/
COPY --from=node-runtime /usr/local/lib/node_modules/ /usr/local/lib/node_modules/

RUN python3 -m pip install --no-cache-dir "setuptools<81" pyparsing

COPY package.json package-lock.json ./
RUN npm ci --include=optional

COPY . .

EXPOSE 4200

CMD ["node", "services/storage-service/server.js"]
