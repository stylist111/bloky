/* eslint-disable no-console */

import path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs/promises";
import mockttp from "mockttp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TELEMETRY_HOSTS = [
  "abp.telemetry.adblockplus.org",
  "adblockplus.telemetry.eyeo.com",
  "adblock.telemetry.getadblock.com",
  "adblock.telemetry.eyeo.com",
  "webext-sdk.test-telemetry.data.eyeo.it",
  "test-telemetry.data.eyeo.it",
];

const USER_ACCOUNTS_HOSTS = [
  "api.ua.eyeo.it",
  "myaccount.adblockplus.org",
  "myaccount.getadblock.com",
];

const WEBSITE_HOSTS = ["getadblock.com", "welcome.adblockplus.org", "adblockplus.org"];

// Filter list requests are passed through to the real servers by default, but
// the hosts need to be TLS-intercepted so that tests can mock specific URLs
const FILTER_LIST_HOSTS = ["easylist-downloads.adblockplus.org"];

const mockServer = mockttp.getLocal({
  cors: true,
  https: {
    certPath: path.join(__dirname, "certificates/testCA.pem"),
    keyPath: path.join(__dirname, "certificates/testCA.key"),
    tlsInterceptOnly: [
      ...TELEMETRY_HOSTS,
      ...USER_ACCOUNTS_HOSTS,
      ...WEBSITE_HOSTS,
      ...FILTER_LIST_HOSTS,
    ].map((hostname) => ({ hostname })),
  },
});

export async function startMockServer(port = 9999) {
  await mockServer.start(port);
  await addDefaultMocks();
  console.log(`Mock HTTP server started on port ${port}`);

  //   // For debugging, you can uncomment these lines
  //   mockServer.on('request', async (req) => {
  //     console.log(`Request received: ${req.method} ${req.url}`);
  //     console.log('Headers:', req.headers);
  //     console.log('Body:', req.body.text || '<no body>');
  //   });

  return mockServer;
}

export async function stopMockServer() {
  await mockServer.stop();
  console.log(`Mock HTTP server stopped`);
}

export async function addDefaultMocks() {
  // Let unmatched requests pass through (e.g., requests to filter lists)
  await mockServer.forUnmatchedRequest().thenPassThrough();
  // EXT-497: we need to bind "testpages.eyeo.com" to "localhost"
  // to be able to test with locally hosted page.
  await addMocksForTestPages();
  // we mock some pages from the website to avoid polluting our analytics
  await addMocksForWebsitePages();
  await addMocksForCDP();
}

// Removes any rules added by individual tests and restores the default rules
export async function resetMockServer() {
  mockServer.reset();
  await addDefaultMocks();
}

export async function addMocksForTestPages() {
  await mockServer
    .forGet()
    .forHost("testpages.eyeo.com:3005")
    .thenCallback(async (req) => {
      const { pathname } = new URL(req.url);

      const filePath = path.join(__dirname, "../host-server/host-pages", pathname);
      try {
        const content = await fs.readFile(filePath);
        return {
          statusCode: 200,
          headers: { "Content-Type": "text/html" },
          body: content,
        };
      } catch (error) {
        if (error.code === "ENOENT") {
          return {
            statusCode: 404,
            body: "Not Found",
          };
        }
        throw error;
      }
    });
}

export async function addMocksForWebsitePages() {
  // We want to mock only a few pages to avoid polluting our analytics
  // when running the tests. Other pages should be left alone.
  const websitePages = [
    "https://getadblock.com/en/uninstall/",
    "https://getadblock.com/en/installed/",
    "https://welcome.adblockplus.org/en/installed",
    "https://adblockplus.org/en/uninstalled",
  ];

  await Promise.all(
    websitePages.map((url) =>
      mockServer.forGet(url).thenCallback((req) => {
        return {
          statusCode: 200,
          headers: { "Content-Type": "text/html" },
          body: `
          <html>
            <body>
              <h1>This is the mock page</h1>
              <p>
                The request made to ${req.url} was intercepted and the response
                was successfully replaced with this page. This was done in order
                to avoid polluting our analytics.
              </p>
            </body>
          </html>`,
        };
      }),
    ),
  );
}

export async function addMocksForCDP() {
  // Mock only the path we expect extension to use for CDP pings
  await Promise.all(
    TELEMETRY_HOSTS.map((host) =>
      mockServer
        .forPost(/^\/topic\/cdp_activeping_noipc\/version\//)
        .forHost(host)
        .thenReply(200, "This is a mock response for CDP POST request"),
    ),
  );
}
