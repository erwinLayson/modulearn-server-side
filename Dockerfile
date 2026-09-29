FROM node:24.18.0 AS server

RUN corepack enable
RUN npm install -g tsc

WORKDIR /server

COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 8000

RUN pnpm run build

CMD ["pnpm", "run", "dev"]