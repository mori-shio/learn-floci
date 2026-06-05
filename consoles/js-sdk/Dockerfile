FROM oven/bun:1-debian

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY . .

EXPOSE 8002

CMD ["bun", "run", "server.tsx"]
