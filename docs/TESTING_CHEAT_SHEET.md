# eyeo's WebExtension Ad-Filtering Solution Testing Cheat Sheet

## Testing core

```
npm run test-core
```

## Unit tests webext build

```
npx webpack --config ./test/unit/mock/webpack.config.js --env filename="subscriptions.js"
```

## Run the unit tests

```
npm run unittest
```

## Functional tests: bundle

```
npm run test-bundle
```

## Functional tests: scripts

```
npm run test-scripts
```

## Start test server

```
npm run test-server
```

## Run tests with test-runner

```
npm test -- {v2|v3} {chromium|firefox|edge} [version|channel] --timeout 10000 --incognito
```

## Performance

```
npm run test-performance -- {v2|v3} {chromium|edge} [--forceHeadful]
```

## Docker runs

### Unit:core

```
docker build -t basic -f test/dockerfiles/basic.Dockerfile .
docker run --cpus=2 --memory=6g --shm-size=2g -it --entrypoint npm basic run test-core -- [test/path]
```

### Func:webext

```
docker build -t functional -f test/dockerfiles/functional.Dockerfile .
docker run --cpus=2 --memory=6g --shm-size=2g -it -e TEST_PARAMS="{v2|v3} {chromium|firefox|edge}" functional
```

### Build container with browser cached in it

```
docker build -t functional -f test/dockerfiles/functional.Dockerfile --build-arg BROWSER=<chromium> .
```

### Compliance

```
MANIFEST="mv2" BROWSER="chromium" VERSION="latest" ./test/scripts/compliance.sh
```

### Performance

```
docker build -t functional -f test/dockerfiles/functional.Dockerfile .
docker run --cpus=2 --memory=6g --shm-size=2g -it --entrypoint npm functional run test-performance {v2|v3} {chromium|edge}
```

### Run docker for tests with [flaky] tag

Running container in a mode that will run only tests that are tagged [flaky]:

```
docker run --cpus=2 --memory=6g --shm-size=2g -it -e TEST_PARAMS="v3 chromium" -e ONLY_FLAKY="true" functional
```

Run [flaky] tests multiple times in a row:

```
docker run --cpus=2 --memory=6g --shm-size=2g -it -e TEST_PARAMS="v3 chromium" -e ONLY_FLAKY="true" -e TEST_RUNS=10 functional
```

### Measure flakiness for whole test suite

```
docker build -t functional -f test/dockerfiles/functional.Dockerfile --build-arg BROWSER=chromium .
docker run --cpus=2 --memory=6g --shm-size=2g -it -e TEST_PARAMS="v3 chromium" -e TEST_RUNS=10 functional
```

### Functional Isolated Tests

```
docker build -t functional -f test/dockerfiles/functional.Dockerfile .
docker run --cpus=2 --memory=6g --shm-size=2g -it -e TEST_SUITES="suite_1 suite_2" -e TEST_PARAMS="v3 chromium" --entrypoint test/dockerfiles/isolated-entrypoint.sh functional
```

## I just want to run the tests on my machine, give me the command

```
npm i
npm run build
npm run test-server
npm run test-core
npm run unittest
npm test -- {v2|v3} {chromium|firefox|edge}
```

### Build and run tests

```
npm run build-then-test -- {v2|v3} {chromium|firefox|edge}
```

### Build and run a specific test

```
npm run build-then-test -- v3 chromium --grep="test name"
```

### Build and run all tests of a specific type

```
npm run build-then-test -- v3 chromium --testKinds="{functional|reload|update|mv2-mv3-migrate|fuzz}"
```
