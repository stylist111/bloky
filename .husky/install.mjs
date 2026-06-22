// Skip on CI and production installs, where the pre-commit hook is irrelevant
// and husky may not be installed (e.g. `npm install --omit=dev`).
if (process.env.CI) {
  process.exit(0);
}

try {
  const husky = (await import("husky")).default;
  husky();
} catch (e) {
  if (e.code !== "ERR_MODULE_NOT_FOUND") throw e;
}
