import path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs/promises";
import mockttp from "mockttp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockServer = mockttp.getLocal({
  cors: true,
  https: {
    certPath: path.join(__dirname, "certificates/testCA.pem"),
    keyPath: path.join(__dirname, "certificates/testCA.key"),
    tlsInterceptOnly: [
      { hostname: "api.ua.eyeo.it" },
      { hostname: "myaccount.adblockplus.org" },
      { hostname: "myaccount.getadblock.com" },
      { hostname: "getadblock.com" },
      { hostname: "welcome.adblockplus.org" },
      { hostname: "adblockplus.org" },
    ],
  },
});

export async function startMockServer(port = 9999) {
  await mockServer.start(port);
  // Let unmatched requests pass through (e.g., requests to filter lists)
  await mockServer.forUnmatchedRequest().thenPassThrough();
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
