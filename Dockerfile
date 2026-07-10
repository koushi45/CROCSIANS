FROM ubuntu:26.04 AS base

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG NODE_VERSION=24.16.0
ENV DEBIAN_FRONTEND=noninteractive
ENV NVM_DIR=/usr/local/nvm
ENV NODE_VERSION=${NODE_VERSION}
ENV PATH=${NVM_DIR}/versions/node/v${NODE_VERSION}/bin:${PATH}

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    git \
    make \
    g++ \
    openssl \
    python3 \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p "${NVM_DIR}" \
  && curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash \
  && source "${NVM_DIR}/nvm.sh" \
  && nvm install "${NODE_VERSION}" \
  && nvm alias default "${NODE_VERSION}" \
  && nvm use default \
  && npm --version

WORKDIR /workspace

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS development
COPY . .
RUN npx prisma generate
EXPOSE 3100
CMD ["bash", "-lc", "npx prisma db push && npm run dev -- --hostname 0.0.0.0 --port 3100"]

FROM deps AS production
COPY . .
ENV NODE_ENV=production
RUN npx prisma generate && npm run build
EXPOSE 3100
CMD ["bash", "-lc", "npx prisma db push && npm run start -- --hostname 0.0.0.0 --port 3100"]
