# betafish-subscriptions.json

## Intro

The contents on the betafish-subscriptions.json file are similiar to the file produced from the rules repository:
https://gitlab.com/adblockinc/ext/rules

The file contains a dictionary of all the filter list subscriptions in AdBlock (both MV2 and MV3 URLs).
It's used to determine the 'adblock id' and a unique index for a filter list.

'url': is the unique key for each entry, and either the MV3 or the MV2 URL
'adblockId': A unique string identifier in human readable form
'id': a unique string GUID, that should match the 'id' from rulesIndex file in the rulesIndex from the @eyeo/filterlists repository (if there is matching entry)
'index': A integer, and unique value. Must remain the same throughout the lifetime of the project. Used in the calculation of the user subscription checksum.

Please review the comments about adding a new filter list in this file (adblock-betafish/picreplacement/sync-service.js).
