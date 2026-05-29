import { describe, it, expect } from 'vitest';
import {
  renderMagicLinkEmail,
  renderApplicantConfirmation,
  renderAdminNotification,
  renderRecoveryEmail,
  renderPaymentPaidAlert,
} from '@/lib/email/templates';

describe('email templates', () => {
  it('magic link email contains the link and reference', () => {
    const e = renderMagicLinkEmail({
      reference: 'MDGH-2026-AAAA1111',
      magicLink: 'https://missdiasporagh.org/apply/form?token=abc',
      cycleClose: '2026-08-15',
    });
    expect(e.subject).toBe('Your MDGH application link');
    expect(e.html).toContain('https://missdiasporagh.org/apply/form?token=abc');
    expect(e.html).toContain('MDGH-2026-AAAA1111');
    expect(e.html).toContain('2026-08-15');
    expect(e.text).toContain('https://missdiasporagh.org/apply/form?token=abc');
  });

  it('applicant confirmation contains reference + retention notice', () => {
    const e = renderApplicantConfirmation({ fullName: 'Ama K.', reference: 'MDGH-2026-AAAA1111' });
    expect(e.subject).toBe("We've received your MDGH application");
    expect(e.html).toContain('Ama K.');
    expect(e.html).toContain('MDGH-2026-AAAA1111');
    expect(e.html.toLowerCase()).toContain('3 years');
  });

  it('admin notification subject includes name + reference', () => {
    const e = renderAdminNotification({
      fullName: 'Ama K.',
      reference: 'MDGH-2026-AAAA1111',
      dashboardUrl: 'https://missdiasporagh.org/admin/applications/abc',
    });
    expect(e.subject).toBe('[MDGH 📝 Application] New application: Ama K. (MDGH-2026-AAAA1111)');
    expect(e.html).toContain('https://missdiasporagh.org/admin/applications/abc');
  });

  it('recovery email contains "(resent)" in subject', () => {
    const e = renderRecoveryEmail({
      reference: 'MDGH-2026-AAAA1111',
      magicLink: 'https://missdiasporagh.org/apply/form?token=xyz',
      cycleClose: '2026-08-15',
    });
    expect(e.subject).toBe('Your MDGH application link (resent)');
    expect(e.html).toContain('xyz');
  });

  it('payment paid alert carries category, tagged subject, and details', () => {
    const e = renderPaymentPaidAlert({
      reference: 'MDGH-2026-AAAA1111',
      email: 'applicant@example.com',
      amountLabel: '25.99 USD',
      dashboardUrl: 'https://missdiasporagh.org/admin/applications/abc',
    });
    expect(e.category).toBe('payment_paid');
    expect(e.subject).toBe('[MDGH 💰 Payment] New paid application — MDGH-2026-AAAA1111');
    expect(e.html).toContain('applicant@example.com');
    expect(e.html).toContain('25.99 USD');
    expect(e.html).toContain('https://missdiasporagh.org/admin/applications/abc');
    expect(e.text).toContain('MDGH-2026-AAAA1111');
  });

  it('payment paid alert HTML-escapes dynamic fields', () => {
    const e = renderPaymentPaidAlert({
      reference: 'REF<script>',
      email: 'a&b@example.com',
      amountLabel: '1.00 USD',
      dashboardUrl: 'https://x/admin?a=1&b=2',
    });
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('REF&lt;script&gt;');
    expect(e.html).toContain('a&amp;b@example.com');
  });
});
