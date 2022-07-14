FROM registry.gitlab.com/eyeo/docker/adblockplus-ci:node16-no-python

# https://www.how2shout.com/linux/install-microsoft-edge-on-linux/
RUN wget https://packages.microsoft.com/keys/microsoft.asc
RUN cat microsoft.asc | gpg --dearmor > microsoft.gpg
RUN install -o root -g root -m 644 microsoft.gpg /etc/apt/trusted.gpg.d/
RUN echo "deb [arch=amd64] https://packages.microsoft.com/repos/edge stable main" > /etc/apt/sources.list.d/microsoft-edge-dev.list
RUN rm microsoft.*
RUN apt-get update && apt-get install -y microsoft-edge-stable

COPY package*.json webext-sdk/
RUN cd webext-sdk && npm install

COPY . webext-sdk/
RUN cd webext-sdk && npm run build

ENV TEST_PARAMS="v2 chromium"
ENTRYPOINT webext-sdk/test/dockerfiles/functional-entrypoint.sh
