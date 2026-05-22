import { z } from 'zod';
import { AGE_BANDS } from '@/lib/eligibility/rules';

export const checkoutCreateSchema = z.object({
  email: z.string().email().max(254),
  ageBand: z.enum(AGE_BANDS as readonly [string, ...string[]]),
  isWoman: z.boolean(),
  africanDescent: z.boolean(),
  outsideGhana: z.boolean(),
  validPassport: z.boolean(),
  consentPolicy: z.literal(true),
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
