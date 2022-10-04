FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node16

COPY . webext-sdk/
RUN cd webext-sdk && npm install

RUN cd webext-sdk && bash -c "npm run test-server &" && npm run subs-run
RUN cd webext-sdk && npm run build

ENV TEST_PARAMS="v2 chromium"
ENTRYPOINT webext-sdk/test/dockerfiles/functional-entrypoint.sh
