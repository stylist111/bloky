# Manifest V3

<div class="no-docs">

## Table of contents

* [Subscribing to events in MV3](#subscribing-to-events-in-mv3)
* [MV3 subscriptions](#mv3-subscriptions)
  * [Basics](#basics)
  * [Converting filter lists to DNR rulesets](#converting-filter-lists-to-dnr-rulesets)
  * [Command line scripts](#command-line-scripts)
  * [Custom subscriptions list](#custom-subscriptions-list)
  * [Adding subscriptions](#adding-subscriptions)

</div>

## Subscribing to events in MV3

The background script in MV3 runs in a service worker which may be
suspended at any time. This has interesting implications for event
listeners. The following rule of thumb applies to browser events as
well events provided by EWE:

__All event listeners should be attached in the first turn of the event loop.__

If you add an event listener after the first turn of the event loop,
you will get all events that happen after you attach the event
listener. However, when the service worker is suspended and is
activated by a new event, you might miss that event because it could
be processed before your listener is reregistered.

## MV3 subscriptions

_Subscriptions_ are how EWE keeps track of filter lists. With the introduction
of Manifest V3 standard, all extensions have to define their filtering rules in
a specific format, which is not originally compatible with our filter list
format.

Therefore, extension developers have to convert filter lists to _rulesets_,
which are then referenced in the extension manifest file. In MV3, both rulesets
and subscriptions need to be bundle and distributed together with the extension.

### Basics

#### Subscription lists

A JSON file with subscription information, defining its details and where it
should be fetched from.

Example:

```
[
  {
    "id": "8C13E995-8F06-4927-BEA7-6C845FB7EEBF",
    "type": "ads",
    "languages": [
      "en"
    ],
    "title": "EasyList",
    "homepage": "https://easylist.to/",
    "url": "https://easylist-downloads.adblockplus.org/v3/full/easylist.txt",
    "mv2_url": "https://easylist-downloads.adblockplus.org/easylist.txt"
  },
  ...
]
```

#### Subscriptions

A text file with filtering rules, referenced by its URL or ID in subscription
lists is a _filter list_. In manifest V2, a subscription consist mostly filter
list, and it has a specific format.

Example:

```
[Adblock Plus 2.0]
! id: 8C13E995-8F06-4927-BEA5-6C885FB7EEBF
...
abptestpages.org###eh-id
...
```

#### DNR rules and rulesets

DNR rules are the filtering rule format used in Manifest V3. They are provided
in ruleset files, which are JSON formatted.

Example:

```
[
  {
    "priority": 1000,
    "condition": {
      "urlFilter": "&werbemittel="
    },
    "action": {
      "type": "block"
    },
    "id": 8163
  },
  ...
]
```

#### Manifest file changes

To be able to filter any network requests, rulesets have to be listed in the
extension manifest file.

Example:

```
{
  "name": "eyeo's WebExtension Ad-Filtering Solution Test Extension",
  "version": "0.0.1",
  "declarative_net_request": {
    "rule_resources": [
      {
        "id": "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F",
        "enabled": false,
        "path": "rulesets/0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F"
      }
    ]
  },
  ...
}
```

Keep in mind that there may be other changes that needs to be done in the
manifest file. Please refer to [official MV3
documentation](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-migration/#updating-manifest-dot-json)
for detailed information.

### Converting filter lists to DNR rulesets

* Get at least one filter list.
* (Optionally) merge several filter lists into a single one, or make changes.
* Download filters.
* Convert filters to DNR rules.
* Add DNR ruleset information to the manifest file.

Depending on project structure and necessary customizations, every extension
will need a separate workflow to deal with this work.

Several command-line scripts are available to help with this process.

### Command line scripts

These scripts are designed to run one after another, using previous scripts
output as input, while allowing custom steps (for transforming data, etc.) in
between to accomodate various workflows.

In the most common use case (no specific requirements and changes needed) the
scripts calls chain might look as follows:

```
# download default subscription list to "scriptsOutput/subscriptions_mv3.json"
npm exec subs-init

# merge all given subscription lists into
# "scriptsOutput/custom-mv3-subscriptions.json"
# in this case, there is only one subscription list, so effectively it is just
# renamed.
npm exec subs-merge

# download subscriptions defined in "scriptsOutput/custom-mv3-subscriptions.json" to
# "scriptsOutput/subscriptions"
npm exec subs-fetch

# convert all subscriptions in "scriptsOutput/subscriptions" to rulesets in
# "scriptsOutput/rulesets"
npm exec subs-convert

# generate manifest file fragment into "scriptsOutput/rulesets/rulesets.json"
npm exec subs-generate
```

#### subs-init

Downloads default subscription list to given output file location. (Default
subscription list is located at
`"https://easylist-downloads.adblockplus.org/v3/index.json"`.)

Usage:

```
npm exec subs-init -- [--output/-o output_file]
```

Options:

* `output`/`o`: Output file. Default: `"scriptsOutput/subscriptions_mv3.json"`

Example:

```
npm exec subs-init -- -o output/subs.json
```

#### subs-merge

Merges subscription lists. This is useful for workflows in which a main
subscription list needs to be merged with a custom one.

If there is only one subscription list, this step can be skipped. However, then
`subs-fetch` script will not work with default options, as it by default expects
output file of this script as input file.

Usage:

```
npm exec subs-merge -- [--input/-i input_file...]
                       [--output/-o output_file]
                       [--space/-s space]
```

Options:

* `input`/`i`: Input file(s). Default: `"scriptsOutput/subscriptions_mv3.json"`
* `output`/`o`: Output file. Default:
  `"scriptsOutput/custom-mv3-subscriptions.json"`
* `space`/`s`: Number of spaces to be used for indentation in the output file.
  Default: `0`

Example:

```
npm exec subs-merge -- -i /data/main_subs.json /tmp/product_subs.json -o /subs/merged.json -s 2
```

#### subs-fetch

Downloads filter lists from the subscriptions defined in input files.

Usage:

```
npm exec subs-fetch -- [--input/-i input_file...]
                       [--output/-o output_dir]
                       [--ignoreFetchErrors/-ife]
```

Options:

* `input`/`i`: Input file(s). Default:
  `"scriptsOutput/custom-mv3-subscriptions.json"`
* `output`/`o`: Output directory. Default: `"scriptsOutput/subscriptions"`
* `ignoreFetchErrors`/`ife`: Whether to ignore fetching errors. This is useful
  when download URL might be unreliable. Default: `false`

Example:

```
npm exec subs-fetch -- -i subs/merged.json -o data/fetched -ife
```

#### subs-convert

Converts filter lists to [rulesets](#converting-filter-lists-to-dnr-rulesets).
It is important to note that conversion only applies to network request rules
(aka URL filters). Other filters will continue to be provided with the filter
list files after this step.
Additionally, this script reads the diff url values from all the converted
filter lists and rewrites the recommended subscriptions file to add a `diff_url`
to all the subscriptions that have one.

Usage:

```
npm exec subs-convert -- [--input/-i input_dir]
                         [--output/-o output_dir]
                         [--report/-r]
                         [--report-output/-O report_dir]
                         [--recommended-subscriptions/-s custom_subscriptions_filename]
                         [--pretty-print/-p]
```

Options:

* `input`/`i`: Input directory. Default: `"scriptsOutput/subscriptions"`
* `output`/`o`: Output directory. Default: `"scriptsOutput/rulesets"`
* `report`/`r`: Boolean flag. If this flag is passed the report is generated.
You can also use `--no-report` to force the report to not be generated.
Default: `false`
* `report-output`/`O`: Report directory. Default: `"scriptsOutput/report"`
* `recommended-subscriptions`/`s`: Path to the file with the recommended
subscriptions. Usually should be the same value as the `--output` from
`subs-merge`. Default: `"scriptsOutput/custom-mv3-subscriptions.json"`
* `pretty-print`/`p`: Whether generated files should be pretty-printed.
Default: `false`

Example:

```
npm exec subs-convert -- -i data/fetched -o data/rulesets -r -O data/report -s data/recommended.json
```

#### subs-generate

Generates web extension manifest fragment. Contents of this file then has to be
added to the manifest file. See [Manifest file changes](#manifest-file-changes)
for details.

Usage:

```
npm exec subs-generate -- [--input/-i input_dir]
                          [--output/-o output_file]
                          [--prefix/-p prefix_text]
```

Options:

* `input`/`i`: Input directory. Default: `"scriptsOutput/rulesets"`
* `output`/`o`: Output file. Default: `"scriptsOutput/rulesets/rulesets.json"`
* `prefix`/`p`: Prefix text to be used in the fragment. (This is mainly used for
  specifying the path.) Default: `""`

Example:

```
npm exec subs-generate -- -i data/rulesets -o data/rulesets.json -p path/to/rulesets/
```

For convenience and testing purposes, running `npm run build` will automatically
run the above scripts to create a meaningful subset of data used in our tests.

### Custom subscriptions list

The default provided subscriptions can be overridden by adding a file called
`custom-mv3-subscriptions.json` in the `scriptsOutput` directory and then using the
following command:
`npm run subs-merge -- [-i ...] -o $(pwd)/scriptsOutput/custom-mv3-subscriptions.json`
to merge the files.

Note the following:

* use `-i` argument to add a file to the list of input files if necessary
* one can use `$(pwd)` on nix-based environments or
  `../../custom-mv3-subscriptions.json` for convenience
* By default these scripts output ruleset files into a folder called
  `scriptsOutput/rulesets` and the full subscription files into
  `scriptsOutput/subscriptions`.

Examples:

* merge product-specific subscriptions file with default subscriptions:

```
npm run subs-merge -- \
  -i /tmp/product-subscriptions.json \
  -o $(pwd)/scriptsOutput/custom-mv3-subscriptions.json
```

* merge two subscriptions files:

```
npm run subs-merge -- \
  -i /tmp/product-subscriptions.json \
  -i /tmp/language_en-subscriptions.json \
  -o $(pwd)/scriptsOutput/custom-mv3-subscriptions.json
```

The scripts are also available via npm symlinks:

```
npm exec subs-init -- -t mv3
npm exec subs-merge [-- -i ... -o ...]
npm exec subs-fetch [-- -i ... -o ...]
npm exec subs-convert [-- -i ... -o ...]
npm exec subs-generate [-- -i ... -o ...]
```

### Adding subscriptions

Before subscriptions are added, availability of subscriptions (that
are added in manifest file) via SDK has to be checked:

```
EWE.subscriptions.getRecommendations();
/* Returns an array of subscriptions
[
  {
    "id": "00000000-0000-0000-0000-000000000000",
    "title": "Test MV3 Custom Subscription",
    "url": "http://myhost.com/subscription.txt",
    ...
  }
  ...
]
*/
```

Then, subscriptions can be added using their urls:

```
EWE.subscriptions.add('http://myhost.com/subscription.txt');
```

To check which subscriptions are added and available:

```
await EWE.subscriptions.getDownloadable();
/*
[
  {
    "id": "00000000-0000-0000-0000-000000000000",
    "enabled": true,
    "title": "Test MV3 Custom Subscription",
    "url": "http://myhost.com/subscription.txt",
    ...
  }
]
*/
```
