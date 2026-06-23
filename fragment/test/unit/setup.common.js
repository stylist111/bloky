// Polyfill IndexedDB for all fragment unit tests. The SDK uses IndexedDB internally,
// so any fragment that imports from it needs this — even if the fragment itself
// does not use IndexedDB directly.
import "fake-indexeddb/auto";

// Set up the vitest-chrome mock as the chrome global. This is required by
// webextension-polyfill, which throws on load unless it sees a
// chrome.runtime.id string in the extension environment.
import { chrome } from "vitest-chrome/lib/index.esm.js";

Object.assign(global, { chrome });
chrome.runtime.id = "unit-testing-extension";
