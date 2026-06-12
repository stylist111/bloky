# Fragments

Fragments are self-contained, host-integrable packages that add discrete features to browser extensions. Each fragment has its own build, tests, and versioning, and is integrated by host extensions as an npm workspace dependency.

## Directory structure

```plaintext
fragment/
├── fragments/                  # Fragment packages
└── test/                       # Functional test extension and test suites
```

## Building

```sh
# Build all fragments
npm run build -- --scope @eyeo-fragments/*
```

## Testing

### Unit tests

```sh
# All fragment unit tests
npm test -- --scope @eyeo-fragments/*

# Single fragment
npm test -- --scope @eyeo-fragments/filter-experiments
```

### Functional tests

Functional tests run in a real browser against the test extension in `fragment/test/`. See [fragment/test/README.md](test/README.md) for full instructions.

```sh
npm run build -- --scope fragments-functional-tests
npm run test:fragments -- -- chromium 3
```
