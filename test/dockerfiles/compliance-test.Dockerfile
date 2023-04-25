ARG EXTENSION=build

# Will be performed if extension is to be copied from local source
FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node16 as extension_copy

ONBUILD RUN echo "I will copy local extension"
# We need to copy to the same folder as it will be built in in webext
ONBUILD COPY dist/test-mv2 dist/test-mv2
ONBUILD COPY /test/dockerfiles/compliance-entrypoint.sh /test/dockerfiles/compliance-entrypoint.sh

# Will be performed if extension has to be built on docker
FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node16  as extension_build

ONBUILD RUN echo "I don't copy extension, will build on docker"
ONBUILD COPY . .
ONBUILD RUN npm install
ONBUILD RUN npm run build

# Will be performed in all cases
FROM extension_${EXTENSION}

RUN npm config set timeout 10000
RUN apt-get update && apt-get install -y git
RUN git clone https://gitlab.com/eyeo/developer-experience/testpages.adblockplus.org
RUN cp -r dist/test-mv2 testpages.adblockplus.org/testext
RUN cd testpages.adblockplus.org/ && npm install

ENTRYPOINT /test/dockerfiles/compliance-entrypoint.sh