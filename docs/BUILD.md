# Сборка Bloky

Репозиторий — форк монорепозитория eyeo (AdBlock, Adblock Plus и их движок фильтрации).
Bloky — это `host/adblock`; остальное (`core/`, `fragment/`, `tools/`) — общий код eyeo.
Подробно об устройстве монорепозитория — [MONOREPO.md](MONOREPO.md).

## Что нужно

- Node.js 24 и npm 11.17 или новее (точные версии — в `mise.toml`).
- Linux или macOS. На Windows — WSL или Docker: скрипты сборки используют bash.
- Доступ к `easylist-downloads.adblockplus.org` во время сборки (движок скачивает тестовые списки).

## Команды

```sh
npm ci
npm run build:release -- --scope adblock -- chrome 3
```

Готовый архив: `host/adblock/dist/release/bloky-chrome-*.zip`.

## Выпуск версии

1. Поднять `version` в `host/adblock/build/config/base.mjs`.
2. Коммит, затем `git tag vX.Y.Z` и `git push origin main vX.Y.Z`.
3. GitHub Actions (`.github/workflows/release.yml`) соберёт архив, SHA256 и подпись происхождения и создаст релиз. Сборка упадёт, если тег не совпадает с версией.

## Обновления списков рекламы

Встроенные списки берут обновления с GitHub Pages этого репозитория
(`https://stylist111.github.io/bloky/v3/diff/…`). Каждые 4 часа
`.github/workflows/filters.yml` скачивает свежие обновления у eyeo и публикует их.
Адрес подставляется при сборке в `tools/rules/src/node/build.js`.

При обновлении пакета `@eyeo/filterlists` впишите прошлый хеш выпуска списков
(из строки `! DiffUrl:` в заголовке любого списка) в `tools/bloky/filter-releases.txt`,
чтобы у пользователей старых версий обновления продолжали приходить.

## Что изменено относительно AdBlock

Все правки помечены комментарием `Bloky:` — `git grep -n "Bloky:"` покажет их.
