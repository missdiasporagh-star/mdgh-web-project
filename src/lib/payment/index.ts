import type { PaymentProvider } from './types';
import { MockProvider } from './mock-provider';

export type ProviderEnv = {
  PAYAZA_PUBLIC_KEY?: string;
  PAYAZA_SECRET_KEY?: string;
  PAYAZA_BASE_URL?: string;
  MOCK_PAYMENTS?: string;
};

export function getPaymentProvider(env: ProviderEnv): PaymentProvider {
  if (env.MOCK_PAYMENTS === 'true') return new MockProvider();
  // PayazaProvider added in M1.10
  throw new Error('PayazaProvider not yet implemented — M1.10 will add it. Set MOCK_PAYMENTS=true for local dev.');
}

export type { PaymentProvider, PaymentInitInput, PaymentInitResult, PaymentVerifyResult, PaymentStatus, Currency } from './types';
export { MockProvider } from './mock-provider';
