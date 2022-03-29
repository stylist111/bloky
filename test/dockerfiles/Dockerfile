FROM registry.gitlab.com/eyeo/docker/adblockplus-ci:node16-no-python

COPY . webext-sdk/
RUN cd webext-sdk && apt-get update && apt-get install -y make g++ && npm install -g npm@8.5.4 && npm install
ENTRYPOINT webext-sdk/test/dockerfiles/edge-entrypoint.sh 