# Reverse Trial fragment

A host-integrable fragment that renders on-page dialogs ("OPDs") during
a time-limited trial of AdBlock Premium features. Dialog content,
scheduling, and behavior are driven entirely by a remote experiment
config flag — no dialog copy or step logic is hardcoded in this
fragment.

> Detailed behavior, schema reference, and PM workflow live on the
> Confluence page **"Reverse Trial OPD Configuration Guide"**. This
> README covers only what you need to integrate or work on the
> fragment itself.

## Directory structure

```plaintext
reverse-trial
├── src
│   ├── background        # Service-worker logic
│   │   ├── reverse-trial.ts     # Entry point + message handlers
│   │   ├── remote-config.ts     # Reads + validates the experiment flag
│   │   ├── url-allowlist.ts     # https + hostname allowlist check
│   │   ├── touchpoints.ts       # Step resolution (which step to show next)
│   │   ├── trial-lifecycle.ts   # Step advancement, trial-end effects
│   │   ├── templating.ts        # URL / text variable substitution, i18n
│   │   └── dialog-payload.ts    # Build the payload sent to content script
│   ├── content           # Content script (dialog rendering in Shadow DOM)
│   └── shared            # Constants and types shared by both sides
└── tests/unit            # Vitest unit tests
```

## Host integration

### Dependency

```json
"@eyeo-fragments/reverse-trial": "*"
```

### Service worker

```js
import { start as startReverseTrial } from "@eyeo-fragments/reverse-trial/background";

startReverseTrial({
  addTrustedMessageTypes: ext.addTrustedMessageTypes,
  prefs: Prefs,
  port,
  logoUrl: browser.runtime.getURL("icons/adblock-20.svg"),
  hasPremium: License.isActiveLicense,
  isOptedOut: async () => Prefs.get("data_collection_opt_out") === true,
  addonVersion: info.addonVersion,
  allowedUrlHosts: ["getadblock.com", "docs.google.com"],
});
```

`allowedUrlHosts` gates every NAVIGATE URL in the remote config — URLs
pointing to any host not listed here are rejected at config load time.
List hostnames exactly (no subdomain matching).

### Content script

Add to the build config and manifest:

```js
// webpack / rollup entry
{ dest: "reverse-trial.preload.js", package: "@eyeo-fragments/reverse-trial", src: "/content" }
```

```json
// manifest.json content_scripts entry
{
  "js": ["polyfill.js", "reverse-trial.preload.js"],
  "matches": ["<target-site-patterns>"],
  "run_at": "document_start"
}
```

### Pref defaults

```js
defaults.reverse_trial_step = 0;
defaults.reverse_trial_start_date = 0;
```

## Remote config

The fragment reads two experiment flags via EWE:

- `show-reverse-trial-opd` (boolean) — gates whether the trial activates
  at all for the user.
- `reverse-trial-opd-config` (object) — the full step schema: durations,
  per-step timing windows, actions, and i18n. See the Confluence page.

Without a valid config in the flag, no dialog is ever shown.

## Building

See the [readme at the root of the monorepo](../../README.md) for
general build, dependency management, how to build the
extensions.

## Testing

### Unit tests

Unit tests are contained in files in `tests/unit/`.

```bash
npm test -- --scope @eyeo-fragments/reverse-trial
```

### Functional tests

Functional / end-to-end tests are handled at the host level.

Additional information can be found under the following internal links:

- [Reverse-Trial OPD — Testing Guide](https://eyeo.atlassian.net/wiki/spaces/B2C/pages/1946517506/Reverse-Trial+OPD+Testing+Guide)
- [Reverse-Trial OPD — Test Tracker](https://eyeo.atlassian.net/wiki/spaces/B2C/pages/1946419202/Reverse-Trial+OPD+Test+Tracker)
