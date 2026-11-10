# Bloky by beyond — brand kit v1.0

## Структура

- `logo/` — SVG (текст в кривых, шрифт не нужен)
  - `bloky-icon.svg` — иконка, основная
  - `bloky-icon-paused.svg` — пауза на сайте (#8A94A6)
  - `bloky-icon-unavailable.svg` — недоступно (#C4CAD4)
  - `bloky-icon-mono-black.svg` / `-mono-white.svg` — монохром (буква вырезана)
  - `bloky-horizontal*.svg` — иконка + «Bloky»: цвет, mono-black, mono-white, paused
  - `bloky-horizontal-by-beyond.svg` — с брендлайном
- `icons/{active,paused,unavailable}/bloky-{16,19,32,38,48,128}.png` — для manifest и chrome.action.setIcon
- `tokens/tokens.css` — CSS-переменные (светлая + тёмная тема: `data-theme="dark"` или системная)
- `tokens/tokens.json` — те же значения для JS / Figma Tokens
- `fonts/` — Inter 400/500/600/700, JetBrains Mono 500 (woff2, лицензия OFL) + `fonts.css`

## Подключение

```html
<link rel="stylesheet" href="fonts/fonts.css" />
<link rel="stylesheet" href="tokens/tokens.css" />
```

```css
body {
  font: var(--type-body);
  color: var(--text-primary);
  background: var(--bg-app);
}
```

## manifest.json (MV3)

```json
"icons": { "16": "icons/active/bloky-16.png", "32": "icons/active/bloky-32.png", "48": "icons/active/bloky-48.png", "128": "icons/active/bloky-128.png" },
"action": { "default_icon": { "16": "icons/active/bloky-16.png", "32": "icons/active/bloky-32.png" } }
```

## Состояния иконки в тулбаре

| Состояние                       | Иконка      | Бейдж                           |
| ------------------------------- | ----------- | ------------------------------- |
| Активно + счётчик               | active      | число, фон #0B1020, макс. «99+» |
| Активно, чисто                  | active      | нет                             |
| На паузе                        | paused      | нет                             |
| Ошибка фильтров                 | active      | «!», фон #D93036                |
| Недоступно (chrome://, магазин) | unavailable | нет                             |

```js
chrome.action.setIcon({
  tabId,
  path: { 16: "icons/paused/bloky-16.png", 32: "icons/paused/bloky-32.png" },
});
chrome.action.setBadgeBackgroundColor({ tabId, color: "#0B1020" });
chrome.action.setBadgeTextColor({ tabId, color: "#FFFFFF" });
chrome.action.setBadgeText({
  tabId,
  text: count > 99 ? "99+" : String(count || ""),
});
```

## Правила

- Цвета: Bloky Blue #2B59FF, Ink #0B1020, белый. Серый — только для состояний.
- В коде используйте семантические токены (`--accent`, `--text-secondary`…), не сырые hex.
- Плоско: границы 1px вместо теней; тень только у меню и тостов.
- Сетка иконки 64: делится на 4 → на 16 px все края в целых пикселях.
