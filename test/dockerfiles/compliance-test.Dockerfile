ARG EXTENSION=build

# Will be performed if extension is to be copied from local source
FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node18 as extension_copy

ONBUILD RUN echo "I will copy local extension"
# We need to copy to the same folder as it will be built in in webext
ONBUILD COPY dist/test-mv2 dist/test-mv2
ONBUILD COPY dist/test-mv3 dist/test-mv3
ONBUILD COPY /test/dockerfiles/compliance-entrypoint.sh /test/dockerfiles/compliance-entrypoint.sh

# Will be performed if extension has to be built on docker
FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node18  as extension_build

ONBUILD RUN echo "I don't copy extension, will build on docker"
ONBUILD COPY . .
ONBUILD RUN npm install
ONBUILD RUN npm run build

# Will be performed in all cases
FROM extension_${EXTENSION}

RUN apt-get update && apt-get install -y git
RUN git clone https://gitlab.com/eyeo/developer-experience/testpages.adblockplus.org
RUN cd testpages.adblockplus.org/ && npm install

ENV CUSTOM_BROWSER="firefox"
ENV MANIFEST="mv2"

ENTRYPOINT /test/dockerfiles/compliance-entrypoint.sh