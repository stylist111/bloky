FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node22

# Doing early `npm install` to cache those files on further image builds If this
# fails saying that the package-lock.json is out of sync, it could mean that a
# new package.json was added which isn't copied here.
COPY *.json .npmrc extensions/
COPY host/adblock/*.json extensions/host/adblock/
COPY host/adblockplus/*.json extensions/host/adblockplus/
COPY tools/test/*.json extensions/tools/test/
COPY core/sdk/*.json extensions/core/sdk/
# scripts and adblockpluscore folders are used by the postinstall host scripts
COPY core/sdk/scripts extensions/core/sdk/scripts
COPY core/sdk/adblockpluscore extensions/core/sdk/adblockpluscore
RUN cd extensions && npm ci

COPY . extensions/
WORKDIR extensions/

ARG BROWSER=
RUN if [ ! -z "$BROWSER" ]; then node core/sdk/test/dockerfiles/get-browser-binaries.js $BROWSER; fi

ENV IS_DOCKER_RUN="true"
ENV TEST_PARAMS="3 chromium"
ENV ONLY_FLAKY="false"
ENTRYPOINT core/sdk/test/dockerfiles/functional-entrypoint.sh
