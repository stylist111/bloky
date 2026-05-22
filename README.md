# Eyeo Web Extensions Monorepo

## The Monorepo Architecture

The extension fragments architecture aims to provide a structured method for
developing complex browser extensions with a focus on adaptability and
scalability. It facilitates the integration of smaller, specialized components
called 'fragments' into the host extension, in order to create customized
extensions with different features and branding to suit various user needs.

This architecture also streamlines dependency management, making development and
collaboration more efficient.

Read more about the architecture [here](./docs/ARCHITECTURE.md).

## Using this repository

### Prerequisites

- node >= 24
- npm >= 11

### Building on Windows

On Windows, you need a [Linux environment running on
WSL](https://docs.microsoft.com/windows/wsl/install-win10). Then install the
above requirements and run the commands below from within Bash.

### Working in this repository

All npm scripts in this sections are run from the root of this repository, and
assume that dependencies have been installed using `npm install`.

```sh
# Installs all dependencies, and updates the package-lock.json file when
# dependencies have been changed.
npm install
```

Rerun the above commands when the dependencies might have changed, e.g. after
checking out a new revision.

#### Dependency management

The `package-lock.json` file and the `node_modules` folder are in the
root of this repository. Any subfolder with a `package.json` might still have a
local `node_modules` folder when different versions of the same dependency are
used.

#### Building the extensions in development mode

The root package in the repository has scripts for building the extensions in the
workspace. These should be preferred over calling the scripts in the individual
packages, since it is aware of the dependencies between packages, and has the
ability to cache build results.

```sh
# Builds everything
npm run build
```

- By default, packages with a build step will put their build output in a
  `dist/` subdirectory.
- Extensions put their unpacked development builds in a `dist/devenv/`
  subdirectory. You can load the directory as an unpacked extension under
  `chrome://extensions` in Chromium-based browsers, and under `about:debugging`
  in Firefox.

#### Building the extensions in release mode

```sh
# Creates release builds
npm run build:release

# Creates the source tarballs for use in store submission
npm run build:source
```

- Extensions put their release builds in a `dist/release/` subdirectory.

#### Building for specific browser configurations

You can also build for only a specific browser configuration. These examples
only work together with a `--scope` argument that limits the CLI parameters to a
package that accepts them (adblock and adblockplus).

```sh
# Builds MV2 firefox extension for Adblock Plus
npm run build -- --scope=adblockplus -- firefox 2
# Builds MV3 chrome extension for AdBlock
npm run build -- --scope=adblock -- chrome 3
# Builds MV2 chrome extension for both hosts in release mode
npm run build:release -- --scope=adblockplus --scope=adblock -- chrome 2
```

Lerna's package filtering commands can also be used here. Two notable filters
are [`--scope`](https://lerna.js.org/docs/api-reference/commands#--scope-glob)
which will filter the script to a specific package and its dependencies, and
[`--since`](https://lerna.js.org/docs/api-reference/commands#--since-ref), which
can filter to target packages which can be affected by the changes on your
git branch.

```sh
# Builds AdBlock in release mode
npm run build:release -- --scope adblock

# Builds anything that has changes on your branch
npm run build -- --since origin/main
```

#### A note on passing CLI arguments to scripts through Lerna

The various building and testing npm scripts at the root of the monorepo use
Lerna. There are a few different programs here that all might accept CLI
arguments, separated by double dashes (`--`).

```sh
npm run build <npm arguments> -- <lerna arguments> -- <script arguments>
```

There are two areas where this is unintuitive.

Firstly, if you don't have any arguments to pass to Lerna, but do have arguments
to pass to the test script, then you still need to list two sets of double
dashes.

```sh
npm test -- -- --grep=foo
```

The second unintuitive aspect is that many packages accept different
arguments. For example, only the hosts accept the browser and manifest version
as arguments to their build scripts. Usually, this means that you must use these
script arguments together with Lerna's `--scope` argument.

```sh
npm run build -- --scope=adblock -- chrome 3
```

#### Running all unit tests

```sh
npm test
```

#### Running a script that is specific to a single workspace

The `--workspace` parameter to `npm run` can be used to target scripts in a
specific workspace.

```sh
npm run --workspace host/adblockplus start
```

See the package-specific README.md files for instructions on these scripts.

#### Significant npm scripts

When adding a new package, consider adding the following npm scripts. This will
make your new package work out of the box in our CI configuration, and will have
it automatically work together with the rest of the monorepo.

All of these scripts are optional.

- `build`: Compile the package in development mode. This should also generate
  typescript type declarations if applicable.
- `build:release`: Compile the package in release mode. If your package needs a
  `build` script, then it must also implement `build:release`, even if its
  implementation is just `npm run build`.
- `build:types`: Generate the typescript type declarations for your
  package. This is probably combined with the `types` or `typesVersions`
  property in your `package.json`. This is called automatically as a dependency
  of the `lint` script, since some lint scripts do type checking.
- `lint`: Do any static analysis of the code, such as eslint, or
  typescript type checking.
- `test`: Run unit tests. This is highly recommended for all packages.

The orchestration of these tasks, for example having the `lint` script run
`build:types`, is defined in [nx.json](./nx.json).

## Code Style

The monorepo has a root level eslint and prettier config. Each package may
choose to define define its own additional linting tasks. These are run for the
whole monorepo at once.

```sh
npm run lint
```

Some style issues can be automatically fixed by running the `lint-fix` command.

```sh
npm run lint-fix
```

## Troubleshooting

### `node-gyp` error?

If you're using an apple machine with apple silicon (arm64 CPU), you may
encounter an error where `node-gyp` fails to build during `npm install`. In that
case you need to run `arch -x86_64 zsh` before any other commands, and make sure
you are not using `nvm` to run the node version.

Another possible cause is that `node-gyp` cannot find the binary online,
then tries to build the binary locally and fails because of Python 3.12 being
installed, [which does not work with some versions of `node-gyp`](https://github.com/nodejs/node-gyp/issues/2869).
That could be solved by installing Python 3.11 locally, and
[`pyenv`](https://github.com/pyenv/pyenv) could be used for that.

### Windows Powershell errors

From Node 22, there are some issues that need to be worked around if you're
using Windows Powershell.

- When calling NPM scripts, "--" is frequently used to separate the NPM
  invocation from the arguments meant for the script. However, since NPM 10,
  Powershell sometimes misinterprets the -- as being part of a Powershell
  command (see [this Node issue](https://github.com/npm/cli/issues/7375)). A
  simple workaround is to quote the --, for example
  `npm run build "--" --scope=adblock`
- When running NPM in the context of a `Start-Process` command, you must use the
  command `npm.cmd`, rather than just `npm` (see [this Node
  issue](https://github.com/npm/cli/issues/7375)).

As an alternative to these workarounds, it is recommended to use Windows
Subsystem for Linux rather than Powershell.

## CI pipeline

### Adding CI config for a new package

There are already jobs configured on the CI pipelines to run `npm run build`,
`npm run build:release`, `npm run lint` and `npm run test` for all npm packages
in the monorepo's workspace. If your new module is in the workspace, and only
needs these jobs, then there is no additional CI config needed.

If your new package has other types of tests that it needs to run in the
pipelines, then you can create a child `.gitlab-ci.yml` in your package, and add
it as a child pipeline in [the root `.gitlab-ci.yml`](./gitlab-ci.yml). See [the
SDK config](./core/sdk/.gitlab-ci.yml) as an example.

### Nightly run

Running a pipeline with the CI variable `NIGHTLY_RUN=true` will trigger a full
set of functional and end-to-end test jobs:

- Additional jobs will run using other browser versions (i.e. beta)
- Some jobs will run N times in parallel, where N is the number of `job_runs`
  defined in [.gitlab/ci-run-jobs-n-times.yml](.gitlab/ci-run-jobs-n-times.yml)

### Runners

Pipeline jobs use self-managed runners from Google Cloud Platform (GCP):

**Linux runners** are managed by the [terraform-eyeo-runner project](https://gitlab.com/eyeo/devops/terraform/projects/gitlab-runners/terraform-eyeo-runner).

**Windows runners** are managed by the [terraform-eyeo-windows-runner project](https://gitlab.com/eyeo/devops/terraform/projects/gitlab-runners/terraform-eyeo-windows-runner). Packages installed by default can
be found [here](https://gitlab.com/eyeo/devops/terraform/projects/gitlab-runners/terraform-eyeo-windows-runner/-/blob/main/packer/scripts/install-base-packages.ps1).

The status of the runners can be checked [here](https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/settings/ci_cd#js-runners-settings)
in the `Group runners` section. Access to GCP resources like the GCloud console
may be granted by devops.

## Contributing

Please see [contributing](CONTRIBUTING.md)
