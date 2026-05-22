/// <reference types="@cloudflare/workers-types" />
/// <reference path="../.astro/types.d.ts" />

type CloudflareEnv = {
  // Bindings
  DB: D1Database;
  MEDIA: R2Bucket;
  KV: KVNamespace;

  // Secrets / vars (set via wrangler secret put + wrangler.jsonc vars)
  PAYAZA_PUBLIC_KEY: string;
  PAYAZA_SECRET_KEY: string;
  APPLY_TOKEN_SECRET: string;
  ADMIN_PASSWORD_HASH: string;
  ADMIN_SESSION_SECRET: string;
  IP_HASH_SALT: string;
  RESEND_API_KEY: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  MOCK_PAYMENTS?: string;
  MOCK_EMAIL?: string;
};

declare namespace App {
  interface Locals {
    runtime: {
      env: CloudflareEnv;
      cf: IncomingRequestCfProperties;
      ctx: ExecutionContext;
    };
  }
}
