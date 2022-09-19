FROM registry.gitlab.com/eyeo/docker/adblockplus-ci:node16-no-python

# Edge dependencies
RUN apt-get install -y fonts-liberation libatomic1 xdg-utils

COPY . webext-sdk/
RUN cd webext-sdk && npm install

ARG MV3_SUBSCRIPTIONS
RUN cd webext-sdk && if [ -n "$MV3_SUBSCRIPTIONS" ]; then bash -c "npm run test-server &" && npm run subs-run -- --type $MV3_SUBSCRIPTIONS; fi
RUN cd webext-sdk && npm run build

ENV TEST_PARAMS="v2 chromium"
ENTRYPOINT webext-sdk/test/dockerfiles/functional-entrypoint.sh
