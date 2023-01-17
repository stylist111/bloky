FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node16

ARG SKIP_BUILD=
ARG BROWSER=
COPY . webext-sdk/
WORKDIR webext-sdk/
RUN npm config set timeout 10000
RUN npm install
RUN if [ -z "$SKIP_BUILD" ]; then npm run build; fi
RUN if [ ! -z "$BROWSER" ]; then node test/dockerfiles/get-browser-binaries.js $BROWSER; fi
ENV TEST_PARAMS="v2 chromium"
ENTRYPOINT test/dockerfiles/functional-entrypoint.sh
