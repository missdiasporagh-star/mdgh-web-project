import { describe, it, expect } from 'vitest';
import {
  renderMagicLinkEmail,
  renderApplicantConfirmation,
  renderAdminNotification,
  renderRecoveryEmail,
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
    expect(e.subject).toBe('[MDGH] New application: Ama K. (MDGH-2026-AAAA1111)');
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
});
