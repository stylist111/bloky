# Tools

## What is this folder?

This is a space for tooling used in the Extensions repository. Things that can be run.

- release - scripts used for releasing, and bumping versions, etc.
- rules - tools used for maintaining the rulesets used in hosts (work in progress)
- [test](./test/README.md) - tools used for testing and running the tests.
- other - currently we have a repo-importer.sh script, used for importing other repos into this one and retaining their histories.

## What does and does not go here?

### Goes here:

- Utilities used for the broad Extensions repository.

### Does not go here:

- Anything that runs at runtime in the actual extensions
- Anything that is specific to a host or a fragment
