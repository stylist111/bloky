#!/bin/bash
# Сборка Bloky (Chrome MV3) в контейнере.
# /src — рабочая папка проекта (только чтение), /work — постоянный том докера с node_modules,
# /out — куда положить zip и распакованную версию.
set -euo pipefail
rsync -a --delete \
  --exclude node_modules --exclude .git --exclude _build --exclude dist \
  --exclude scriptsOutput --exclude .nx \
  /src/ /work/
cd /work
# зависимости ставим заново, только если поменялся package-lock.json
if ! cmp -s package-lock.json node_modules/.lock-copy 2>/dev/null; then
  npm ci --no-audit --no-fund 2>&1 | tail -3
  cp package-lock.json node_modules/.lock-copy
fi
if [ "${1:-}" = "test" ]; then
  # модульные тесты расширения, проверка типов и линтер по изменённым частям
  (cd host/adblock && npx vitest run ./src/ ./test/unit/ 2>&1 | tail -25)
  echo "=== tsc"; (cd host/adblock && npx tsc --noEmit 2>&1 | tail -30; echo "tsc exit ${PIPESTATUS[0]}")
  echo "=== eslint"; npx eslint --ext .js,.mjs,.ts host/adblock/adblock-betafish host/adblock/src tools/rules/src tools/bloky \
    core/sdk/src/background/account core/sdk/src/background/subscriptions.js 2>&1 | tail -30; echo "eslint exit ${PIPESTATUS[0]}"
  exit 0
fi
rm -rf host/adblock/dist
npm run build:release -- --scope adblock -- chrome 3 > /tmp/build.log 2>&1 || {
  cp /tmp/build.log /out/build.log
  grep -n -iE -A6 "error in|module not found|syntaxerror|cannot find|TS[0-9]{4}|Error:" /tmp/build.log | grep -v "npm error" | head -80
  exit 1
}
zip=$(ls host/adblock/dist/release/*.zip)
rm -rf /out/unpacked && mkdir -p /out/unpacked
cp "$zip" /out/
cd /out/unpacked && unzip -q "/work/$zip"
echo "OK: $(basename "$zip")"
