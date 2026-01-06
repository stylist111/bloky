# test-utils

Tools used for testing and running the tests. See `index.js` and `package.json`
for exports details.

## Test server

The test server offers two independent groups of endpoints.

SDK:

```
SDK pages server listening at http://localhost:3000
SDK Admin commands server listening at http://localhost:3003
SDK Web Socket Server listening at ws://localhost:3001
```

Host:

```
Host pages server listening at http://localhost:3005
Host license server listening at http://localhost:3006
Host IPM server listening at http://localhost:3007
```

Those endpoins can run either programmatically or from the command line:

```sh
# SDK test server
npm run -w @eyeo/test-utils start-sdk-server
# Host test server
npm run -w @eyeo/test-utils start-host-server
```

## Mock HTTP/HTTPS proxy/server

`mock-http-server` offers utilities to instanciate an instace of a mock
HTTP/HTTPS server capabale of intercepting requests to any urls and mocking
their responses.

In order to intercept HTTPS traffic the server needs certificates which can
be found in the `/certificates` folder. Certificates should be valid until 2035.

To generate new certificates valid for 10 years you can run:

```sh
openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes \
  -keyout testCA.key -out testCA.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

## Helper extension

Used to open the options page of a host extension.

## E2E runner

Used to run E2E tests in hosts and fragments.
