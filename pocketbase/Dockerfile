FROM alpine:3.22

# Install dependencies
RUN apk add --no-cache \
    ca-certificates \
    unzip \
    wget

# Download PocketBase for the target architecture and verify its checksum
ARG PB_VERSION=0.40.5
ARG TARGETARCH=amd64
RUN ZIP=pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip \
    && wget -q https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${ZIP} \
    && wget -q https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/checksums.txt \
    && grep " ${ZIP}\$" checksums.txt | sha256sum -c - \
    && unzip ${ZIP} -d /usr/local/bin/ \
    && rm ${ZIP} checksums.txt

# Copy migrations
COPY pocketbase/pb_migrations /pb_migrations
COPY pocketbase/pb_hooks /pb_hooks

# Expose port
EXPOSE 8090

# Start PocketBase
CMD ["/usr/local/bin/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data", "--migrationsDir=/pb_migrations", "--hooksDir=/pb_hooks"]
