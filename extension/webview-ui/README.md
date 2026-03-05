# FlowSync Extension — Webview UI

React + TypeScript + Vite app that runs inside the VS Code extension panel (webview).

---

## Views

| View | Description |
|---|---|
| `Welcome` | Default screen — shown when no `.flowsync.json` is found |
| `InitProject` | Multi-step form to initialize a new FlowSync project |
| `JoinProject` | Form to join an existing project using a shared API token |
| `Dashboard` | Context timeline for the current branch |
| `CatchMeUp` | Summary of teammate changes since last checkpoint |
| `Chat` | Conversational interface over project context |

---

## Dev setup

```bash
cd extension/webview-ui
npm install
npm run dev      # Vite dev server at http://localhost:5173
```

> In dev mode the webview communicates via `window.acquireVsCodeApi()` mock. Run the full extension via `F5` in VS Code to test in the real panel.

## Build

```bash
npm run build    # outputs to webview-ui/build/ — consumed by the extension
```

The extension's webpack config copies the built output into the VSIX. Always run `npm run build` before packaging the extension with `npm run vsix` (from the parent `extension/` directory).

---

## Tech stack

- **React 19** + **TypeScript**
- **Vite 7** for bundling
- **CSS Modules** for styling (custom dark theme matching VS Code)
- VS Code webview messaging via `vscode.postMessage` / `window.addEventListener('message', ...)`

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
