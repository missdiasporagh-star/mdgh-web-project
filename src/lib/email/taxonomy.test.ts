import { describe, it, expect } from 'vitest';
import { applySubjectTag, CATEGORY_META } from './taxonomy';

describe('applySubjectTag', () => {
  it('prefixes team-facing categories', () => {
    expect(applySubjectTag('payment_paid', 'New paid application — REF1'))
      .toBe('[MDGH 💰 Payment] New paid application — REF1');
    expect(applySubjectTag('contact_message', 'Hello'))
      .toBe('[MDGH ✉️ Contact] Hello');
    expect(applySubjectTag('application_submitted', 'New application: Ama (REF2)'))
      .toBe('[MDGH 📝 Application] New application: Ama (REF2)');
  });

  it('leaves applicant-facing categories untouched', () => {
    expect(applySubjectTag('magic_link', 'Your MDGH application link'))
      .toBe('Your MDGH application link');
    expect(applySubjectTag('applicant_confirmation', "We've received your MDGH application"))
      .toBe("We've received your MDGH application");
  });

  it('marks team vs applicant audience correctly', () => {
    expect(CATEGORY_META.payment_paid.teamFacing).toBe(true);
    expect(CATEGORY_META.magic_link.teamFacing).toBe(false);
  });
});
