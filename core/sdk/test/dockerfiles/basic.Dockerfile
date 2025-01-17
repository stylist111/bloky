FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node18

COPY .npmrc package*.json webext-sdk/
COPY adblockpluscore/package.json webext-sdk/adblockpluscore/
RUN cd webext-sdk/ && npm ci

COPY . webext-sdk/
WORKDIR webext-sdk/

