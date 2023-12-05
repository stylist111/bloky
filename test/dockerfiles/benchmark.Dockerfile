FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node18

COPY . webext-sdk/
WORKDIR webext-sdk
RUN npm install
ENTRYPOINT test/dockerfiles/benchmark-entrypoint.sh
