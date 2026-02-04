ARG NODE_VERSION=18
ARG MODE=production
ARG BUILD_DATE=unknown
ARG VCS_REF=unknown
ARG VERSION=${VCS_REF}-dev


FROM node:${NODE_VERSION}-alpine AS build

WORKDIR /md

COPY ["./package.json", "./package-lock.json", "./"]
RUN ["npm", "ci"]

COPY ["./src", "./src"]
COPY ["./tsconfig.json", "./config.json5", "./"]
RUN ["npm", "run", "build"]


FROM node:${NODE_VERSION}-alpine

ARG VERSION
ARG BUILD_DATE
ARG VCS_REF
ARG MODE

ENV MD_CONFIG_PATH="config.json5" \
    MD_VERSION=${VERSION} \
    NODE_ENV=${MODE}

LABEL org.opencontainers.image.created=${BUILD_DATE}
LABEL org.opencontainers.image.url="https://github.com/ccomarato/potagainsthumanity"
LABEL org.opencontainers.image.source="https://github.com/ccomarato/potagainsthumanity"
LABEL org.opencontainers.image.version=${VERSION}
LABEL org.opencontainers.image.revision=${VCS_REF}
LABEL org.opencontainers.image.vendor="Webswerve <hobos@webswerve.com>"
LABEL org.opencontainers.image.licenses="AGPL-3.0+"
LABEL org.opencontainers.image.title="PoT Against Humanity (Server)"
LABEL org.opencontainers.image.description="The web server for PoT Against Humanity, the recognized symbol of excellence in online gaming."

WORKDIR /md

COPY ["./package.json", "./package-lock.json", "./"]
RUN ["npm", "ci", "--only=production"]

COPY ["./config.json5", "./"]
COPY ["./decks", "./decks"]
COPY --from=build ["/md/dist", "./"]

EXPOSE 8081
USER node
CMD ["node", "./index.js"]
