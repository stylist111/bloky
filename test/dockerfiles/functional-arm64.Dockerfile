# Duplicated from registry.gitlab.com/eyeo/docker/get-browser-binary:node16
# https://gitlab.com/eyeo/developer-experience/get-browser-binary/-/issues/46
FROM node:16-bullseye-slim
# General packages
RUN apt-get update && apt-get install -y git procps wget unzip bzip2 gnupg
# xvfb (headful browser run)
RUN apt-get install -y libgtk-3-0 libxt6 xvfb libnss3 libxss1
# General browser dependencies
RUN apt-get install -y libgconf-2-4 libasound2 libgbm1
# Edge dependencies
RUN apt-get install -y fonts-liberation libatomic1 xdg-utils libu2f-udev

# Chromium ARM
RUN apt-get install -y chromium

ARG SKIP_BUILD=
ARG BROWSER=
COPY package*.json webext-sdk/
RUN cd webext-sdk/ && npm install

COPY . webext-sdk/
WORKDIR webext-sdk/
RUN npm config set timeout 10000
RUN npm install
RUN if [ -z "$SKIP_BUILD" ]; then npm run build; fi
RUN if [ ! -z "$BROWSER" ]; then node test/dockerfiles/get-browser-binaries.js $BROWSER; fi
ENV TEST_PARAMS="v2 chromium"
ENV MODE="Default"
ENV RUN_ONLY_FLAKY="false"
ENTRYPOINT test/dockerfiles/functional-entrypoint.sh
