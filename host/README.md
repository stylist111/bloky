# Host extensions

Hosts are self-contained packages that represent releasable web extensions. Each host is composed of shared code in the form of core utilities, fragments and external dependencies, as well as host-specific code.

## Directory structure

```
host/
└── <host>/
    ├── build/                      # Build scripts and other CLI tooling
    ├── dist/                       # Distribution files
    │   ├── devenv/                 # Unpacked extension directories
    │   └── release/                # Extension release builds
    ├── locale/ (or _locales/)
    │   ├── en_US/                  # Base strings (US English)
    │   └── <locale>/               # Translation files
    ├── src/                        # Extension source code
    │   └── <feature>/              # Extension feature
    │       ├── all/ (or shared/)     # Code for any execution context
    │       ├── background/           # Code for background process
    │       ├── content/              # Code for isolated world
    │       ├── content-ui/           # Code for UI page injected into main world
    │       ├── front/                # Code for UI page and isolated world
    │       ├── main/                 # Code for main world
    │       └── ui/                   # Code for UI page
    └── test/                       # End-to-end tests (and legacy unit tests)
```

The extension source code is generally located in the host's src/ directory where it is grouped by feature.

Code for each feature is further grouped by [execution context](../README.md#extension-execution-contexts).

Each feature/context combination can include one or more of the following files:

- `index.*` files: Exports functionality for other features or compatible contexts within the same feature.
- `*.entry.*`: File that are referenced directly in either the extension's manifest or its build configuration.\
  _e.g. bootstrap.entry.ts, index.entry.css, options.entry.html_

## Building

See the [readme at the root of the monorepo](../README.md) for
general build and dependency instructions.

## Testing

### Unit tests

```sh
npm test -- --scope adblock
npm test -- --scope adblockplus
```

### Functional tests

Functional tests run in a real browser against the respective host extension.

```sh
npm run build:release
npm run test:end-to-end -- --scope adblock -- chromium 3
npm run test:end-to-end -- --scope adblockplus -- chromium 3
```
