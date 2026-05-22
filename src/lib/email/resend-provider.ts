import type { EmailProvider, EmailMessage, EmailSendResult } from './types';
import { FROM_ADDRESS } from './templates';

export class ResendProvider implements EmailProvider {
  constructor(private readonly apiKey: string) {}
  async send(msg: EmailMessage): Promise<EmailSendResult> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: msg.from ?? FROM_ADDRESS,
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        return { ok: false, errorCode: `HTTP_${res.status}`, errorMessage: errBody };
      }
      const json = await res.json() as { id: string };
      return { ok: true, providerMessageId: json.id };
    } catch (e) {
      return { ok: false, errorCode: 'NETWORK_ERROR', errorMessage: e instanceof Error ? e.message : String(e) };
    }
  }
}
