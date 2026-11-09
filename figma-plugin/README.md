# Плагін Figma «Goodface DS (local)»

Збирає файл Figma з прототипу: дизайн-код і Figma мають однакові назви токенів, компонентів і варіантів.

## Запуск

1. Figma desktop → Plugins → Development → **Import plugin from manifest…** → `figma-plugin/manifest.json`.
2. Plugins → Development → Goodface DS → потрібна команда:
   - **Build everything** — змінні (Primitives → Semantic, світла й темна), текстові стилі, компоненти з варіантами й документацією, екран TO-BE у двох темах зі станами, плюс звірка Figma ↔ код;
   - **Apply dark theme to selection** — переводить виділені шари в темну тему;
   - **Add submission texts** — додає картки з текстами здачі (аудит, час, труднощі, AI, продукт), більше нічого не змінює.

## Перезібрати

```
node figma-plugin/build-plugin.js
```

Це перезбирає `code.js` з `prototype/tokens.css`, `prototype/theme.css`, `screen-*.json` і текстів з `docs/`. Знімок екрана (`screen-*.json`) оновлює `node figma-plugin/extract-screen.js light|dark`. Для нього потрібен прототип на `localhost:5173` і Chrome. `node figma-plugin/test-mock.js` проганяє плагін на імітації Figma API без самої Figma.
