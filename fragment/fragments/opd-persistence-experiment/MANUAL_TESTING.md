# Manual testing on a real page

Local-only setup for testing the OPD persistence experiment (`crumbs-opd-config`)
against a real build, without relying on the live production experiment and
without a rebuild. It works by temporarily patching `fetch` in the background
console so the one request the extension makes to the real remote config URL
returns a fake payload instead of hitting the network. This is the same
mechanism the OPD e2e tests use (`setRemoteConfigExperiments`/
`setRemoteConfigIpmCommands` against a local mock server), just done live in
the console against a real build instead of through a mock server.

Not for commit — this is a console script you paste in, not a source change.

## 1. Open the background console

`chrome://extensions` → enable Developer mode → find the extension → click
the blue **service worker** link (not a regular tab's console).

## 2. Paste this (adjust the two marked lines per host)

```js
// --- adjust these two for the extension you're testing ---
const buttonTarget = "https://adblockplus.org"; // AdBlock: "https://getadblock.com"
const domainList = "192.168.1.1,192.168.0.1,example.com";
// -----------------------------------------------------------

const REMOTE_CONFIG_URL =
  "https://easylist-downloads.adblockplus.org/ab-testing/experiments.json";
const ipmId = "manual_router_test";
const maxImpressions = 3;

const fakeConfig = {
  schemaId: "1", // must be the string "1" - anything else fails validation
  experiments: [
    {
      experimentId: "opd_persistence_manual_test",
      variants: [
        {
          variantId: "enabled",
          mods: [0, 1000], // covers the whole range - always assigned
          flags: {
            "crumbs-opd-config": {
              [ipmId]: { maxImpressions, ignoreCooldown: true },
            },
          },
          ipmCommands: [
            {
              command_name: "create_on_page_dialog",
              ipm_id: ipmId,
              version: 8,
              timing: "after_navigation",
              button_target: buttonTarget,
              domain_list: domainList,
              content: {
                en: {
                  sub_title: "Router domain detected",
                  upper_body: "Manual test of the persistent OPD experiment.",
                  button_label: "Got it",
                },
              },
            },
          ],
        },
      ],
    },
  ],
};

if (!self.__realFetch) self.__realFetch = self.fetch.bind(self);
self.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (url !== REMOTE_CONFIG_URL) return self.__realFetch(input, init);
  return new Response(JSON.stringify(fakeConfig), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

await ewe.remoteConfig.sync();
await ewe.remoteConfig.getSyncStatus(); // errors should be []
await ewe.experiments.getFlags(); // should include crumbs-opd-config
```

This is schema-valid against `@eyeo/remote-configuration-validator` (required
`experimentId`/`variants`, `variantId`/`flags`/`mods`, and the OPD command's
required `command_name`/`ipm_id`/`version`/`button_target`/`content.en`/
`timing`). `button_target` must be one of the extension's `ipm:safe_origins`
(`https://adblockplus.org` for Adblock Plus, `https://getadblock.com` for
AdBlock) or the command gets silently rejected as invalid.

## 3. Test on the router page

Navigate to a matching page — the dialog should appear on each qualifying
load (reload counts as an impression too), and stop appearing after
`maxImpressions` (3 above).

## 4. Re-running a round

Since `ignoreCooldown: true` bypasses the global cooldown, you only need to
clear the per-campaign state:

```js
await chrome.storage.local.remove([
  "pref:onpage_dialog_command_stats",
  "pref:ipm:dismissed_ipm_ids",
]);
```

or simpler: bump `ipmId` to a fresh value (e.g. `"manual_router_test_2"`) and
re-run the whole script.

## 5. Cleanup

```js
self.fetch = self.__realFetch;
await ewe.remoteConfig.sync(); // restores the real production config
```

## Known gotchas

- **`schemaId` must be the string `"1"`**, not the number `1` and not an
  arbitrary placeholder. The lookup that picks a schema validator coerces it
  to a string key either way, but the JSON schema itself requires
  `type: "string"`. Anything else fails validation silently from the
  console's point of view: `remoteConfig.sync()` just logs a warning and
  returns without ever applying the fake data. Check
  `await ewe.remoteConfig.getSyncStatus()` (`.errors`) if flags don't show up
  after a sync.
- The service worker can be respawned by the browser at any idle point, which
  drops the `fetch` patch (it only lives in that specific service worker
  instance's memory). Keep devtools open on the service worker during the
  test to prevent it from going idle; if the dialog stops appearing
  unexpectedly, re-run the whole script.
