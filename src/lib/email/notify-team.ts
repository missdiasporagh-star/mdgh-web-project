import type { EmailProvider } from './types';
import type { EmailEnv } from './index';
import { getEmailProvider } from './index';
import { renderAdminNotification, renderPaymentPaidAlert } from './templates';

/** Internal team inboxes that receive activity alerts. */
export const TEAM_NOTIFY = ['missdiasporagh@gmail.com', 'info@missdiasporagh.org'];

/** App-submitted also notifies the existing applications@ inbox. */
const APP_SUBMITTED_RECIPIENTS = ['applications@missdiasporagh.org', ...TEAM_NOTIFY];

export type TeamAlertEvent =
  | {
      kind: 'payment_paid';
      appId: string;
      reference: string;
      email: string;
      amountLabel: string;
      dashboardUrl: string;
    }
  | {
      kind: 'application_submitted';
      fullName: string;
      reference: string;
      dashboardUrl: string;
    };

type NotifyEnv = EmailEnv & { KV: KVNamespace };

/**
 * Send a team activity alert. `payment_paid` is guarded by a KV key so the
 * poller + webhook (both call runPaymentVerification) produce exactly one alert.
 * The guard is set only after a successful send, so a transient send failure can
 * still be retried by a later call. Provider is injectable for testing.
 */
export async function notifyTeam(
  env: NotifyEnv,
  event: TeamAlertEvent,
  provider: EmailProvider = getEmailProvider(env),
): Promise<void> {
  if (event.kind === 'payment_paid') {
    const guardKey = `team-notified-paid:${event.appId}`;
    if (await env.KV.get(guardKey)) return;
    const msg = renderPaymentPaidAlert({
      reference: event.reference,
      email: event.email,
      amountLabel: event.amountLabel,
      dashboardUrl: event.dashboardUrl,
    });
    const res = await provider.send({ to: TEAM_NOTIFY, ...msg });
    if (res.ok) await env.KV.put(guardKey, '1', { expirationTtl: 60 * 60 * 24 * 30 });
    return;
  }

  const msg = renderAdminNotification({
    fullName: event.fullName,
    reference: event.reference,
    dashboardUrl: event.dashboardUrl,
  });
  await provider.send({ to: APP_SUBMITTED_RECIPIENTS, ...msg });
}
