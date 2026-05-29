import type { EmailCategory } from './taxonomy';

export type EmailMessage = {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  text: string;
  category: EmailCategory;
};

export type EmailSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; errorCode: string; errorMessage: string };

export interface EmailProvider {
  send(msg: EmailMessage): Promise<EmailSendResult>;
}
