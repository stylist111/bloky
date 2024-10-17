FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node18

COPY .npmrc package*.json webext-sdk/
COPY core/package.json webext-sdk/core/
RUN cd webext-sdk/ && npm ci

COPY . webext-sdk/
WORKDIR webext-sdk/
