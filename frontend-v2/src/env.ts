/**
 * CONTRACT local engine.
 * Unset VITE_API_BASE in `npm run dev` uses same-origin `/api` (Vite proxy to :8000)
 * because the engine's CORS list is 5173 only. Override with VITE_API_BASE.
 * Outside dev the default is http://localhost:8000.
 */
const fromEnv = import.meta.env.VITE_API_BASE as string | undefined;

export const API_BASE: string =
  fromEnv !== undefined ? fromEnv : import.meta.env.DEV ? "" : "http://localhost:8000";
