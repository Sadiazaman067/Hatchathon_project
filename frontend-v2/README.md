# LadderProof frontend-v2

Home: New test, Examples, This session. Dual conveyor report plus live upload → convert → confirm names → run comparison.

Port **5174** so it does not collide with the existing `frontend/` app on 5173.

## Run the UI

```bash
cd frontend-v2
npm install
npm run dev
```

Open http://localhost:5174

## Run the engine (already documented)

From the repo root, with Python 3.14:

```bash
pip install -r requirements.txt
uvicorn backend.app.api:app --reload --port 8000
```

See `docs/interfaces.md`. The engine's CORS list is `localhost:5173` only. This app's Vite server proxies `/api` to `:8000`, so live calls work on 5174 without changing the backend.

`VITE_API_BASE` overrides the API origin. Unset in `npm run dev` means same-origin `/api` (the proxy). Outside dev the default is `http://localhost:8000`.

## Examples vs live reports

**Examples** loads stored demonstration reports (badge: Demonstration data). **New test** talks to the engine. Live reports do not get that badge. This session is only this browser tab.

## Keyboard (report replay)

When conveyor replay is enabled: Space play/pause, Left step back, Right step forward. Keys are ignored in text inputs, textareas, and selects.

## Build and tests

```bash
npm run build
npm test
```
