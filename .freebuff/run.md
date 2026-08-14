# StemDeck — dev server run doc

## Reproduce uncommitted artifacts

- No `.env*` files are used by this project — nothing to copy from the main checkout.
- Install dependencies (Vite + React, PWA plugin):

  ```bash
  npm install
  ```

  This installs from `package-lock.json` (no registry changes expected).

## Run the server

- Dev server (Vite, default port **5173**):

  ```bash
  npm run dev
  ```

- If 5173 is taken, Vite auto-picks the next free port (5174, …) — read the
  startup log for the actual URL.
- Production preview (after `npm run build`):

  ```bash
  npm run preview
  ```
