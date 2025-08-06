## Fragments Tests

### **Testing Instructions**

1. **Setup the environment**

   - Run the following commands from the monorepo root:
     ```sh
     npm i
     npm run build
     ```

2. **Run Fragments Tests Locally**

   - Execute the following command from the monorepo root:
     ```sh
     BROWSER=chromium MANIFEST_VERSION=3 FORCE_HEADFUL=false npm run --workspace fragment/test test:fragments-local
     ```
   - You can try different combinations of browsers (`chromium`, `firefox`, `edge`) and manifest versions (`2`, `3`).

   **Expected Output**

   ```
   > fragments-test-extension@1.0.0 test:fragments-local
   > node run-tests.js

   Helper extension built to .../monorepo/extensions/fragment/test/dist/devenv/helper-extension
   Host pages server listening at http://localhost:3005
   Host IPM server listening at http://localhost:3007
   Host license server listening at http://localhost:3006

     Fragments Tests
   Installed chromium 134.0.6998.89 ...
   Browser: chrome 134.0.6998.0
   Extension: Fragments Test Extension 1.0.0 MV3
       Sample Test
         ✔ should always pass 1

     1 passing (11s)

   Stopping test server...
   Test pages server stopped
   License server closed
   IPM server closed
   ```

3. **Screenshots for Failing Tests**
   - Screenshots are saved in:
     ```sh
     fragment/test/screenshots
     ```

### **Troubleshooting**

- Ensure dependencies are installed by running `npm i` before executing the tests.
- If tests fail unexpectedly, try running in headful mode by setting:
  ```sh
  FORCE_HEADFUL=true
  ```
- Check browser compatibility and ensure the correct version is installed.
