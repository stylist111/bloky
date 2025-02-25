# Third-party code

The workspaces in this directory represent third-party code that we use in the
monorepo, which cannot be brought in using npm directly.

Expected content:
- Forks of npm packages
- Functionality for which there is no npm package

Considering the additional effort that's associated with maintaining our own
copies/forks of third-party code, as well as the licensing terms related to
hosting them in the monorepo, we should prefer integrating third-party
functionality via npm.
