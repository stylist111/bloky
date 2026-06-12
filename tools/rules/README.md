# @eyeo/rules-utils

Tools for retrieving filter lists and generating rules files from various sources for use in AdBlock and Adblock Plus.

## Integration

- Include content of `dist/{adblock|adblockplus}/manifest/{adblock|adblockplus}.json` in manifest.json file.
- Include `dist/{adblock|adblockplus}/rules/abp/*` in build as `data/rules/abp/*`.
- Include `dist/{adblock|adblockplus}/rules/dnr/*` in build as `data/rules/dnr/*`.
- Import index from `@eyeo/rules-utils/{adblock|adblockplus}/index/{adblock|adblockplus}.json` to `EWE.start()`.

  ```js
  import index from "@eyeo/rules-utils/adblock/index/adblock.json";

  EWE.start({ bundledSubscriptions: index, … });
  ```

### Rules data generation

```mermaid
graph TD;
  index-eyeo("@eyeo/filterlists/filterlists/index.json") --> index-selected
  config(config/*.js) --> index-selected
  server-subscriptions("@eyeo/filterlists/filterlists/*") --> rules-abp
  index-selected(index/*.json) --> rules-abp
  rules-abp(rules/abp/*) -->|EWE: subs-convert| rules-dnr
  rules-dnr(rules/dnr/*) -->|EWE: subs-generate| manifest(manifest/*.json)
  rules-abp --> ext-rules-abp(data/rules/abp/*)
  rules-dnr --> ext-rules-dnr(data/rules/dnr/*)
  manifest --> ext-manifest(manifest.json)
  index-selected -->|EWE: subs-convert| ext-rec("@eyeo/rules-utils/*/index/*.json")
  subgraph build
    ext-manifest --> ext(Extension build)
    ext-rec --> ext
    ext-rules-abp --> ext
    ext-rules-dnr --> ext
  end
  ext -->|EWE: start| ext-sdk("@eyeo/webext-ad-filtering-solution")

  classDef data stroke-width:2px
  classDef ext fill:#F002
  classDef dist stroke:none

  class config data
  class ext data
  class ext-manifest dist
  class ext-rec dist
  class ext-rules dist
  class index-adblockinc data
  class index-eyeo data
  class index-selected dist
  class manifest dist
  class rules-abp data
  class rules-dnr dist
```

## Testing

### Unit tests

Unit tests are contained in `src/**/*.spec.js` files.

```bash
npm test -- --scope @eyeo/rules-utils
```

### End-to-end tests

End-to-end tests are contained in `test/end-to-end/`.

```bash
npm test:end-to-end -- --scope @eyeo/rules-utils
```
