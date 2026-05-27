# Filter Experiments fragment

A fragment that applies experimental filters in sync with
feature flags. When a flag whose ID ends in `:filters` is active,
the fragment adds the filter strings it carries as user filters (tagged
with `origin: "experiment"` and the flag ID). When the flag is removed
or its value changes, stale filters are cleaned up automatically.

## Host integration

### Service worker

```js
import { start as startFilterExperiments } from "@eyeo-fragments/filter-experiments/background";

startFilterExperiments();
```

`start()` runs an initial sync and registers a listener on
`ewe.experiments.onChanged` so filters stay current whenever flags
change.

## Feature flag convention

Only flags whose ID ends in `:filters` are processed. Their value must
be a non-empty array of filter strings, e.g.:

```json
{
  "my-experiment:filters": ["||ads.example.com^", "||tracker.example.com^"]
}
```

Filters are validated via `ewe.filters.validate` before being added.
Invalid or duplicate filters are skipped with a console warning.

## Testing

### Unit tests

```bash
npm test -- --scope=@eyeo-fragments/filter-experiments
```

Unit tests live in `src/background/`.

### Functional tests

Functional tests run against the fragment test extension in
`fragment/test/` and cover the full add / remove / re-attribution
lifecycle in a real browser. Run from the repo root:

```bash
npm run build
BROWSER=chrome MANIFEST_VERSION=3 FORCE_HEADFUL=false \
  npm run --workspace fragments-test test:fragments-local
```

## Building

See the [readme at the root of the monorepo](../../README.md) for
general build and dependency instructions.

## Caveats

When a user tries to add a filter that was already added by an experiment, the operation is a no-op — the filter list remains unchanged.

For that reason, it is recommended for experiments to not use
common filters (e.g. `@@||example.com^$document`) to avoid users
getting that no-op when potentially adding such filters.
