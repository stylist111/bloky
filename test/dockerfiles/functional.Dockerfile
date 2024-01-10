FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node18

ARG SKIP_BUILD=
ARG BROWSER=
COPY package*.json webext-sdk/
RUN cd webext-sdk/ && npm install

COPY . webext-sdk/
WORKDIR webext-sdk/
RUN npm install
RUN if [ -z "$SKIP_BUILD" ]; then npm run build; fi
RUN if [ ! -z "$BROWSER" ]; then node test/dockerfiles/get-browser-binaries.js $BROWSER; fi

ENV TEST_PARAMS="v2 chromium"
ENV ONLY_FLAKY="false"
ENV TEST_RUNS=1
ENTRYPOINT test/dockerfiles/functional-entrypoint.sh
