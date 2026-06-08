/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKER_API_URL: string
  readonly VITE_DIFY_WORKFLOW_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}