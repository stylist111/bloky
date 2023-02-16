FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node16

COPY . webext-sdk/
WORKDIR webext-sdk/
RUN npm config set timeout 10000
RUN npm install
ENV TEST_PARAMS=""
ENV MODE="Default"
ENTRYPOINT test/dockerfiles/core-entrypoint.sh
