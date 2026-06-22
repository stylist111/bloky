FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node24

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
# .husky/install.mjs is invoked by the root postinstall script during `npm ci`
COPY .husky extensions/.husky
RUN cd extensions && npm ci

COPY . extensions/
WORKDIR extensions/

ENV MANIFEST_VERSION=3
ENV BROWSER=chromium
ENTRYPOINT npm run test:fragments -- --scope=fragments-functional-tests -- $BROWSER $MANIFEST_VERSION
