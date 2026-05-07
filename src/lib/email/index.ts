import type { EmailProvider } from './types';
import { ResendProvider } from './resend-provider';
import { MockEmailProvider } from './mock-provider';

export type EmailEnv = { RESEND_API_KEY?: string; MOCK_EMAIL?: string };

export function getEmailProvider(env: EmailEnv): EmailProvider {
  if (env.MOCK_EMAIL === 'true' || !env.RESEND_API_KEY) return new MockEmailProvider();
  return new ResendProvider(env.RESEND_API_KEY);
}

export type { EmailProvider, EmailMessage, EmailSendResult } from './types';
export { MockEmailProvider } from './mock-provider';
export { ResendProvider } from './resend-provider';
export * from './templates';
