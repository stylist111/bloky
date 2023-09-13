FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node18

COPY . webext-sdk/
WORKDIR webext-sdk/
RUN npm install
ENV TEST_PARAMS=""
ENV MODE="Default"
ENTRYPOINT test/dockerfiles/core-entrypoint.sh
