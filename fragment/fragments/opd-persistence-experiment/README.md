# OPD Persistence Experiment fragment

A fragment that reads per-campaign overrides for on-page dialog (OPD)
impression caps and cooldown handling from remote experiment flags. Hosts
use it to let a specific IPM campaign be shown more than once, and/or to
take that campaign out of the shared OPD cooldown, without changing the
default behavior for every other campaign.

## Host integration

### Service worker

```ts
import {
  getCampaignConfig,
  start as startOpdPersistenceExperiment,
} from "@eyeo-fragments/opd-persistence-experiment/background";

await startOpdPersistenceExperiment();

// Later, when evaluating whether/how to show a dialog for a given IPM
// campaign:
const campaignConfig = getCampaignConfig(dialog.ipmId);
```

`start()` performs an initial read of the experiment flags and registers a
listener on `ewe.experiments.onChanged` so configurations stay current
whenever flags change. `getCampaignConfig()` is synchronous and looks up the
most recently read configuration for the given IPM ID.

## Feature flag convention

Flags whose name starts with the `crumbs-opd-config` prefix are read. Every
matching flag's value must be an object keyed by IPM ID:

```json
{ "<ipm_id>": { "ignoreCooldown": true, "maxImpressions": 3 } }
```

Every campaign has to be listed explicitly — there is no default key.
`maxImpressions` accepts 1 to 20; anything outside that range, or an entry
that configures nothing, leaves the campaign untouched rather than
half-applying. Because experiment flag names must be unique, an experiment
that carries this configuration appends its own id to the base name (e.g.
`crumbs-opd-config-experiment-7`); every flag matching the prefix is read, so
two experiments can configure campaigns at the same time. Campaigns belong to
one experiment each, so their entries can't collide in practice; if the same
campaign is listed under two matching flags, the alphabetically first flag
name wins.

## Building

See the [readme at the root of the monorepo](../../README.md) for
general build and dependency instructions.

## Testing

### Unit tests

Unit tests are contained in `src/**/*.spec.ts` files.

```bash
npm test -- --scope @eyeo-fragments/opd-persistence-experiment
```

### Manual testing

See [MANUAL_TESTING.md](./MANUAL_TESTING.md) for instructions on testing the
experiment against a real build, without relying on the live production
experiment.
