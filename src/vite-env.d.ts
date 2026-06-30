/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the paper-trading backend, e.g. http://localhost:8787/api.
   *  When unset, the dashboard runs on its built-in simulated data. */
  readonly VITE_BOT_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
