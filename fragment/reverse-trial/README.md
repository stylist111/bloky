# Reverse Trial fragment

## Intro

This fragment implements the reverse trial feature for AdBlock Premium video ads. It shows
3 sequential dialogs during a 14-day trial period, guiding users from trial start
through midpoint to expiration.

The fragment contains:

- **Content Script**: Runs on designated pages, requests dialog data from the service worker, and
  renders the appropriate dialog in a closed Shadow DOM with inline CSS. Sends a dismiss message
  back to the background when the user interacts with the dialog.
- **Service Worker Logic**: Manages trial state, resolves which touch point to show based on
  trial start date and last shown step, and returns dialog payloads to the content script.
  Advances the step only when a dismiss message is received.

### Touch Points

| #   | Name     | When                            | Button                | Action             |
| --- | -------- | ------------------------------- | --------------------- | ------------------ |
| 1   | Start    | First visit to a matched site   | "Thanks!"             | Dismiss            |
| 2   | Midpoint | Visit with 7 or fewer days left | "Get AdBlock Premium" | Opens premium page |
| 3   | Ended    | Visit after trial expired       | "Get AdBlock Premium" | Opens premium page |

Each dialog remains visible until the user dismisses it (via the close button or CTA).
The step only advances when the dismiss message is received by the background, not when the
dialog is returned. After touch point 3 is dismissed, no more dialogs appear.

### Trial Start Date

The trial period begins on the **first visit to a matched website** (not on extension install).
When the content script requests a dialog for the first time (step 0, no existing start date),
the background sets `reverse_trial_start_date` to `Date.now()`. All subsequent time calculations
(midpoint, ended) are relative to this date.

## Directory structure

```plaintext
fragment/reverse-trial
├── src
│   ├── background       # Service worker logic (message handling, touch point resolution)
│   ├── content          # Content script (dialog rendering in Shadow DOM)
│   └── shared           # Shared constants, types, and interfaces
├── tests                # Unit tests for the fragment
│   └── unit
```

## Architecture

### Message Protocol

The content script communicates with the service worker via `browser.runtime.sendMessage`:

| Direction             | Message                                                                              | Response                |
| --------------------- | ------------------------------------------------------------------------------------ | ----------------------- |
| content -> background | `{ type: "reverse-trial.get-dialog" }`                                               | `DialogPayload \| null` |
| content -> background | `{ type: "reverse-trial.dialog-action", touchPointStep: N, action: "close"\|"cta" }` | _(fire-and-forget)_     |

The first message requests the dialog payload. The background returns the payload but does
**not** advance the step. The second message is sent when the user dismisses the dialog
(close button or CTA click). The background advances the step upon receiving this message.

The `touchPointStep` field ensures idempotency — if multiple tabs show the same dialog,
only the first dismiss advances the step.

### State Model

Two pref keys track the trial state:

- `reverse_trial_step` — The last completed touch point:
  - `0` - No touch point dismissed yet
  - `1` - "Start" was dismissed
  - `2` - "Midpoint" was dismissed
  - `3` - "Ended" was dismissed (done)
- `reverse_trial_start_date` — Epoch ms when the trial began (set on first visit to a matched site)

### Experiment Flag

The feature is gated behind the `show-reverse-trial-opd` experiment flag, checked via
`ewe.experiments.getFlag()` at initialization.

## How to integrate

### Add the dependency

Add this line to your dependencies in `package.json`:

```json
"@eyeo-fragments/reverse-trial": "*"
```

### Integrating the service worker

1. **Import the start function**

   ```javascript
   import { start as startReverseTrial } from "@eyeo-fragments/reverse-trial/background";
   ```

2. **Execute the start function** inside your initialization chain (after prefs are loaded):

   ```javascript
   startReverseTrial({
     addTrustedMessageTypes: ext.addTrustedMessageTypes,
     prefs: Prefs,
     port,
     logoUrl: browser.runtime.getURL("icons/adblock-20.svg"),
     premiumUrl: "https://getadblock.com/premium/?s=reverse_trial_opd",
     hasPremium: License.isActiveLicense,
   });
   ```

### Integrating the content script

1. **Add the content script to the bundled files** in your build config:

   ```javascript
   {
     dest: "reverse-trial.preload.js",
     package: "@eyeo-fragments/reverse-trial",
     src: "/content",
   }
   ```

2. **Add the content script to `manifest.json`** in the appropriate content scripts entry:

   ```json
   {
     "js": ["polyfill.js", "reverse-trial.preload.js"],
     "matches": ["<target-site-patterns>"],
     "run_at": "document_start"
   }
   ```

### Add the pref defaults

In your prefs configuration, add:

```javascript
defaults.reverse_trial_step = 0;
defaults.reverse_trial_start_date = 0;
```

## Running scripts

Please note that all scripts should be run from the root of the repository, not
this fragment folder.

## Building

See the [readme at the root of the monorepo](../../README.md) for general
instructions on prerequisites, dependency management, how to build the
extensions.

## Testing

### Unit testing

The `./tests/unit` folder contains unit tests for both background and content logic.
Tests can be run via `npm run test`.

### End-to-end testing

Integration tests are located in `fragment/test/suites/reverse-trial.js` and run
against a real browser using the fragment test extension framework.
