FROM oven/bun:1-debian

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl unzip zip ca-certificates jq less redis-tools \
    && rm -rf /var/lib/apt/lists/*

RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64) AWS_ARCH=x86_64 ;; \
      aarch64|arm64) AWS_ARCH=aarch64 ;; \
      *) echo "Unsupported arch: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}.zip" -o /tmp/awscliv2.zip && \
    cd /tmp && unzip -q awscliv2.zip && ./aws/install && \
    rm -rf /tmp/aws /tmp/awscliv2.zip

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY . .

EXPOSE 8000

CMD ["bun", "run", "server.tsx"]
