# Плагін Figma «Goodface DS (local)»

Збирає файл Figma з прототипу: дизайн-код і Figma мають однакові назви токенів, компонентів і варіантів.

## Запуск

1. Figma desktop → Plugins → Development → **Import plugin from manifest…** → `figma-plugin/manifest.json`.
2. Plugins → Development → Goodface DS → потрібна команда:
   - **Build everything** — змінні (Primitives → Semantic, світла й темна), текстові стилі, компоненти з варіантами й документацією і сторінка TO-BE: дошка Logic (як працює екран) і два ряди, темний і світлий, — Blocks (стани окремих блоків), Collapsed, Expanded, In the red; зелені стрілки від того, що натискається, до того, що відкривається; звірка Figma ↔ код над дошками;
   - **Apply dark theme to selection** — переводить виділені шари в темну тему;
   - **Add submission texts** — додає картки з текстами здачі (аудит, час, труднощі, AI, продукт), більше нічого не змінює;

## Перезібрати

```
node figma-plugin/build-plugin.js
```

Це перезбирає `code.js` з `prototype/tokens.css`, `prototype/theme.css`, `screen-*.json` і текстів з `docs/`. Знімок (`screen-*.json`) оновлює `node figma-plugin/extract-screen.js light|dark`: екран, екран Expanded, стани блоків і точки для стрілок; стан «у мінусі» — `node figma-plugin/extract-screen.js light|dark states`. Стрілки — звичайні вектори (конектори Figma є лише у FigJam): якщо пересунути дошку, стрілки лишаться на місці — запустіть Build everything ще раз. Для нього потрібен прототип на `localhost:5173` і Chrome. `node figma-plugin/test-mock.js` проганяє плагін на імітації Figma API без самої Figma.
