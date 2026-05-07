import type { EmailProvider, EmailMessage, EmailSendResult } from './types';

export class MockEmailProvider implements EmailProvider {
  public sent: EmailMessage[] = [];
  async send(msg: EmailMessage): Promise<EmailSendResult> {
    this.sent.push(msg);
    return { ok: true, providerMessageId: `mock-${this.sent.length}` };
  }
}
