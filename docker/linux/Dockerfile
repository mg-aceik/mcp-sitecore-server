# Pinned to Node 24 to match the Windows image and CI, so all environments behave
# identically.
FROM node:24-alpine

WORKDIR /app

# Install dependencies without prepare scripts
COPY package*.json tsconfig.json rollup.config.js ./
RUN npm install --ignore-scripts

# Build application
COPY src ./src
RUN npm run build

RUN npm run bundle

# Remove dev dependencies
RUN npm prune --production

# This image exposes an HTTP port, so serve over streamable-http by default.
ENV TRANSPORT=streamable-http

# The server binds loopback by default, which a published container port cannot reach --
# a container's own loopback is not the host's. Binding every interface is correct inside
# the container; what the port is exposed to is decided by the `docker run -p` mapping.
# Set AUTHORIZATION_HEADER when that mapping is anything other than 127.0.0.1.
ENV HOST=0.0.0.0

# Default start
CMD ["node","dist/index.js"]

# Expose port
EXPOSE 3001

# Report unhealthy if the HTTP server stops responding on its liveness endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O - http://localhost:3001/health || exit 1