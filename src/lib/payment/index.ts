import type { PaymentProvider } from './types';
import { MockProvider } from './mock-provider';
import { PayazaProvider } from './payaza-provider';

export type ProviderEnv = {
  PAYAZA_PUBLIC_KEY?: string;
  PAYAZA_SECRET_KEY?: string;
  PAYAZA_BASE_URL?: string;
  MOCK_PAYMENTS?: string;
};

export function getPaymentProvider(env: ProviderEnv): PaymentProvider {
  if (env.MOCK_PAYMENTS === 'true') return new MockProvider();
  if (!env.PAYAZA_SECRET_KEY || !env.PAYAZA_BASE_URL) {
    throw new Error('Payaza env vars missing — set PAYAZA_SECRET_KEY and PAYAZA_BASE_URL');
  }
  return new PayazaProvider({
    PAYAZA_PUBLIC_KEY: env.PAYAZA_PUBLIC_KEY ?? '',
    PAYAZA_SECRET_KEY: env.PAYAZA_SECRET_KEY,
    PAYAZA_BASE_URL: env.PAYAZA_BASE_URL,
  });
}

export type { PaymentProvider, PaymentInitInput, PaymentInitResult, PaymentVerifyResult, PaymentStatus, Currency } from './types';
export { MockProvider } from './mock-provider';
export { PayazaProvider } from './payaza-provider';
