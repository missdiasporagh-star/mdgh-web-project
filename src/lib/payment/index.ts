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
  if (!env.PAYAZA_PUBLIC_KEY) {
    throw new Error('Payaza env missing — set PAYAZA_PUBLIC_KEY (and PAYAZA_SECRET_KEY for webhook verification)');
  }
  return new PayazaProvider({
    PAYAZA_PUBLIC_KEY: env.PAYAZA_PUBLIC_KEY,
    PAYAZA_SECRET_KEY: env.PAYAZA_SECRET_KEY ?? '',
  });
}

export type { PaymentProvider, PaymentInitInput, PaymentInitResult, PaymentVerifyResult, PaymentStatus, Currency, PayazaSdkBootstrap } from './types';
export { MockProvider } from './mock-provider';
export { PayazaProvider } from './payaza-provider';
