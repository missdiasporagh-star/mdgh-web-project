import { z } from 'zod';
import { AGE_BANDS } from '@/lib/eligibility/rules';

export const checkoutCreateSchema = z.object({
  email: z.string().email().max(254),
  // Phone in E.164 format ("+" + country-code digit 1-9 + 6-14 more digits).
  // Required so Payaza's server-side verify doesn't reject the transaction
  // with status_reason="Length is 0 digits but must be at least 1 country code digit".
  phone: z.string().regex(/^\+[1-9][0-9]{6,14}$/, 'phone must include country code (e.g. +233244000000)'),
  ageBand: z.enum(AGE_BANDS as readonly [string, ...string[]]),
  isWoman: z.boolean(),
  africanDescent: z.boolean(),
  outsideGhana: z.boolean(),
  validPassport: z.boolean(),
  consentPolicy: z.literal(true),
  // Explicit, dedicated acknowledgment that the fee is non-refundable. Required
  // (must be true) — server-enforced so an applicant cannot reach payment
  // without ticking it. Chargeback/dispute defense for the paid flow; the Terms
  // (also accepted via consentPolicy) state the same, this makes it unmissable.
  consentRefund: z.literal(true),
  consentMediaUse: z.boolean(),
  consentMarketing: z.boolean(),
  honeypot: z.string().max(0, 'Bot detected'),
  turnstileToken: z.string().min(1),
});
export type CheckoutCreateInput = z.infer<typeof checkoutCreateSchema>;

export const notificationsSubscribeSchema = z.object({
  email: z.string().email().max(254),
  source: z.enum(['eligibility_disqualified', 'cycle_closed', 'manual']),
  disqualifyingRule: z.enum(['age', 'gender', 'heritage', 'residency', 'passport']).nullable(),
  honeypot: z.string().max(0),
});
export type NotificationsSubscribeInput = z.infer<typeof notificationsSubscribeSchema>;
