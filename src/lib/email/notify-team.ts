import type { EmailProvider } from './types';
import type { EmailEnv } from './index';
import { getEmailProvider } from './index';
import { renderAdminNotification, renderPaymentPaidAlert } from './templates';

/** Internal team inboxes that receive activity alerts. */
export const TEAM_NOTIFY = ['missdiasporagh@gmail.com', 'info@missdiasporagh.org'];

/** App-submitted also notifies the existing applications@ inbox. */
const APP_SUBMITTED_RECIPIENTS = ['applications@missdiasporagh.org', ...TEAM_NOTIFY];

/** How long the payment-paid alert dedupe guard lives. 30 days comfortably
 *  covers the post-cycle review window — well past when poller/webhook retries
 *  for a given transaction could still arrive. */
const PAID_ALERT_GUARD_TTL_SECONDS = 60 * 60 * 24 * 30;

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
    if (res.ok) await env.KV.put(guardKey, '1', { expirationTtl: PAID_ALERT_GUARD_TTL_SECONDS });
    return;
  }

  // application_submitted fires once per submission (no poller), so no guard.
  // A send failure here is non-fatal — callers wrap this in .catch().
  const msg = renderAdminNotification({
    fullName: event.fullName,
    reference: event.reference,
    dashboardUrl: event.dashboardUrl,
  });
  await provider.send({ to: APP_SUBMITTED_RECIPIENTS, ...msg });
}
