export const MOMO_FEE_CENTS = 23000;
export const MOMO_CURRENCY = 'GHS';
export const MOMO_NUMBER = '0598913323';
export const MOMO_RECIPIENT = 'Ebenezer Adjetey Sowah';
export const MOMO_INTERNATIONAL = '+233598913323';
export const MOMO_WHATSAPP = 'https://wa.me/233598913323';
export const MANUAL_REFERENCE_PREFIX = 'MOMO-';
/** Temporary default; set PAYMENT_MODE=payaza to restore gateway checkout. */
export function manualPaymentsEnabled(env: { PAYMENT_MODE?: string; MOCK_PAYMENTS?: string }): boolean {
  return env.PAYMENT_MODE !== 'payaza' && env.MOCK_PAYMENTS !== 'true';
}
export function isManualReference(reference: string): boolean {
  return reference.startsWith(MANUAL_REFERENCE_PREFIX);
}
