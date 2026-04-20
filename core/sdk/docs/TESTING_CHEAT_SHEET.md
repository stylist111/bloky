# eyeo's WebExtension Ad-Filtering Solution Testing Cheat Sheet

## Unit tests

```
npm test
```

## Adblockpluscore browser tests

```
npm run -w adblockpluscore test:browser
```

## Bundle tests

```
npm run -w @eyeo/webext-ad-filtering-solution test:bundle
```

## Start test server

```
npm run -w @eyeo/test-utils start-sdk-server
```

## Run tests with test-runner

```
npm run -w @eyeo/webext-ad-filtering-solution test:functional -- {2|3} {chromium|chrome|firefox|edge} [version|channel] --timeout 10000 --incognito
```

## Performance

```
npm run -w @eyeo/webext-ad-filtering-solution test:performance -- {2|3} {chromium|chrome|edge} [--forceHeadful] [--slow] [--saveBaseline]
```

## Docker runs

### Unit:adblockpluscore

```
docker build -t basic -f core/sdk/test/dockerfiles/basic.Dockerfile .
docker run --shm-size=2g -it --entrypoint npm basic run -w adblockpluscore test:unit -- [test/path]
```

### Func:webext

```
npm run -w @eyeo/webext-ad-filtering-solution build
docker build -t functional -f core/sdk/test/dockerfiles/functional.Dockerfile .
docker run --shm-size=2g -it -e TEST_PARAMS="{2|3} {chromium|chrome|firefox|edge}" functional
```

### Build container with browser cached in it

```
docker build -t functional -f core/sdk/test/dockerfiles/functional.Dockerfile --build-arg BROWSERS="chromium chrome" .
```

### Compliance

```
MANIFEST="mv2" BROWSER="chromium" VERSION="latest" ./core/sdk/test/scripts/compliance.sh
```

### Performance

```
docker run --shm-size=2g -it -e NODE_OPTIONS="--max-old-space-size=4096" --entrypoint npm functional run -w @eyeo/webext-ad-filtering-solution test:performance -- {2|3} {chromium|chrome|edge} [--slow] [--saveBaseline]
```

### Run docker for tests with [flaky] tag

Running container in a mode that will run only tests that are tagged [flaky]:

```
docker run --shm-size=2g -it -e TEST_PARAMS="3 chrome" -e ONLY_FLAKY="true" functional
```

### Functional Isolated Tests

```
docker run --shm-size=2g -it -e TEST_SUITES="suite_1 suite_2" -e TEST_PARAMS="3 chrome" --entrypoint core/sdk/test/dockerfiles/isolated-entrypoint.sh functional
```

## I just want to run the tests on my machine, give me the command

```
npm i
npm run -w @eyeo/webext-ad-filtering-solution build
npm run -w @eyeo/webext-ad-filtering-solution test
npm run -w @eyeo/webext-ad-filtering-solution test:functional -- {2|3} {chromium|chrome|firefox|edge}
```

### Build and run tests

```
npm run -w @eyeo/webext-ad-filtering-solution build-then-test -- {2|3} {chromium|chrome|firefox|edge}
```

### Build and run a specific test

```
npm run -w @eyeo/webext-ad-filtering-solution build-then-test -- 3 chrome --grep="test name"
```

### Build and run all tests of a specific type

```
npm run -w @eyeo/webext-ad-filtering-solution build-then-test -- 3 chrome --testKinds="{functional|reload|update|mv2-mv3-migrate|fuzz}"
```
