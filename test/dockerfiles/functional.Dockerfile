FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node16

ARG SKIP_BUILD=

COPY . webext-sdk/
WORKDIR webext-sdk/

RUN npm install

RUN if [ -z "$SKIP_BUILD" ]; then bash -c "npm run test-server &" && npm run subs-run; fi
RUN if [ -z "$SKIP_BUILD" ]; then npm run build; fi

ENV TEST_PARAMS="v2 chromium"
ENTRYPOINT test/dockerfiles/functional-entrypoint.sh
