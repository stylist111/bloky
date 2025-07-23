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

## Helper extension

Used to open the options page of a host extension.

## E2E runner

Used to run E2E tests in hosts and fragments.
