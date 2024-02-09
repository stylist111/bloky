# eyeo's WebExtension Ad-Filtering Solution Testing Cheat Sheet

## Testing core

```
npm run test-core
```

## Benchmark core

```
docker build -t benchmark -f test/dockerfiles/benchmark.Dockerfile .
docker run --cpus=2 --memory=8g --shm-size=2g benchmark
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
npm test -- {v2|v3|v2-custom} {chromium|firefox|edge} [version|channel] --timeout 10000 --incognito
```

## Docker runs

### Unit:core

```
docker build -t core -f test/dockerfiles/core.Dockerfile .
docker run --cpus=2 --memory=8g --shm-size=2g -e TEST_PARAMS="(path to the test to run)" -it core
```

### Func:webext

```
docker build -t functional -f test/dockerfiles/functional.Dockerfile .
```

```
docker run --cpus=2 --memory=8g --shm-size=2g -e TEST_PARAMS="{v2|v3|v2-custom} {chromium|firefox|edge}" -it functional
```

### Build container with browser cached in it

```
docker build -t functional -f test/dockerfiles/functional.Dockerfile --build-arg BROWSER=<chromium> .
```

### Compliance tests

```
MANIFEST="mv2" BROWSER="chromium" VERSION="latest" ./test/scripts/compliance.sh
```

### Run docker for tests with [flaky] tag

```
# Building container
docker build -t functional -f test/dockerfiles/functional.Dockerfile .

# Running container in a mode that will run only tests that are tagged [flaky]
docker run --cpus=2 --memory=8g --shm-size=2g -e TEST_PARAMS="v3 chromium" -e ONLY_FLAKY="true" -it functional
```

The command above will run tests once. If you want to run tests multiple times
in a row use the following command:

```
docker run --cpus=2 --memory=8g --shm-size=2g -e TEST_PARAMS="v3 chromium" -e ONLY_FLAKY="true" -e TEST_RUNS=10 -it functional
```

### Measure flakiness for whole test suite

```
docker build -t functional -f test/dockerfiles/functional.Dockerfile --build-arg BROWSER=chromium .
docker run --cpus=2 --memory=8g --shm-size=2g -e TEST_PARAMS="v3 chromium" -e TEST_RUNS=10 -it functional
```

## I just want to run the tests on my machine, give me the command

```
npm i
npm run build
npm run test-server
npm run test-core
npm run unittest
npm test -- {v2|v3|v2-custom} {chromium|firefox|edge}
```

### Build and run tests

```
npm run build-then-test {v2|v3|v2-custom} {chromium|firefox|edge}
```

### Build and run a specific test

```
npm run build-then-test v3 chromium -- --grep="test name"
```

### Build and run all tests of a specific type

```
npm run build-then-test v3 chromium -- --testKinds="{functional|reload|update|mv2-mv3-migrate|fuzz}"
```
