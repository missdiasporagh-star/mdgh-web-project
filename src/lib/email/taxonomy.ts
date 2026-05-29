export type EmailCategory =
  | 'payment_paid'
  | 'application_submitted'
  | 'contact_message'
  | 'magic_link'
  | 'applicant_confirmation'
  | 'application_recovery';

type CategoryMeta = { teamFacing: boolean; subjectTag: string | null };

export const CATEGORY_META: Record<EmailCategory, CategoryMeta> = {
  payment_paid:           { teamFacing: true,  subjectTag: '[MDGH 💰 Payment]' },
  application_submitted:  { teamFacing: true,  subjectTag: '[MDGH 📝 Application]' },
  contact_message:        { teamFacing: true,  subjectTag: '[MDGH ✉️ Contact]' },
  magic_link:             { teamFacing: false, subjectTag: null },
  applicant_confirmation: { teamFacing: false, subjectTag: null },
  application_recovery:   { teamFacing: false, subjectTag: null },
};

/** Prefix team-facing subjects with their tag; leave applicant subjects untouched. */
export function applySubjectTag(category: EmailCategory, subject: string): string {
  const tag = CATEGORY_META[category].subjectTag;
  return tag ? `${tag} ${subject}` : subject;
}
