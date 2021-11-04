FROM node:16 as node-build
WORKDIR /usr/src/app

COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:16 as node-run
WORKDIR /usr/src/app

COPY package.json ./
RUN npm install --only=production
COPY --from=node-build /usr/src/app/dist .

CMD ["node", "index.js"]