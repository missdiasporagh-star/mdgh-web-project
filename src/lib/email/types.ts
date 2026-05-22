export type EmailMessage = {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; errorCode: string; errorMessage: string };

export interface EmailProvider {
  send(msg: EmailMessage): Promise<EmailSendResult>;
}
