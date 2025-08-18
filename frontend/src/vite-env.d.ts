/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_OPCUA_API_BASE: string;
  readonly VITE_OIDC_ISSUER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
