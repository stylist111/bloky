FROM registry.gitlab.com/eyeo/docker/get-browser-binary:node18

COPY package*.json webext-sdk/
RUN cd webext-sdk/ && npm install

COPY . webext-sdk/
WORKDIR webext-sdk/
RUN npm install
