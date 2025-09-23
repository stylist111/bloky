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
