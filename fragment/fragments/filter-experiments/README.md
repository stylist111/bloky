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

## Building

See the [readme at the root of the monorepo](../../README.md) for
general build and dependency instructions.

## Testing

### Unit tests

Unit tests are contained in `src/**/*.spec.ts` files.

```bash
npm test -- --scope @eyeo-fragments/filter-experiments
```

### Functional tests

Functional tests run in a real browser against the test extension in `fragment/test/`. See [fragment/test/README.md](test/README.md) for full instructions.

```sh
npm run build -- --scope fragments-functional-tests
npm run test:fragments -- -- chromium 3
```

## Caveats

When a user tries to add a filter that was already added by an experiment, the operation is a no-op — the filter list remains unchanged.

For that reason, it is recommended for experiments to not use
common filters (e.g. `@@||example.com^$document`) to avoid users
getting that no-op when potentially adding such filters.
