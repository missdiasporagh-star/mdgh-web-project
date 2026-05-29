import { describe, it, expect } from 'vitest';
import { MockEmailProvider } from './mock-provider';
import { notifyTeam, TEAM_NOTIFY } from './notify-team';

function fakeKV() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => { store.set(k, v); },
  };
}

const baseEnv = { MOCK_EMAIL: 'true' as const };

describe('notifyTeam', () => {
  it('payment_paid: sends to the team list with payment_paid category', async () => {
    const provider = new MockEmailProvider();
    const kv = fakeKV();
    await notifyTeam({ ...baseEnv, KV: kv as any }, {
      kind: 'payment_paid', appId: 'app1', reference: 'REF1',
      email: 'x@y.com', amountLabel: '25.99 USD', dashboardUrl: 'https://d/app1',
    }, provider);

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toEqual(TEAM_NOTIFY);
    expect(provider.sent[0].category).toBe('payment_paid');
    expect(provider.sent[0].subject).toContain('[MDGH 💰 Payment]');
  });

  it('payment_paid: second call for the same appId sends nothing (idempotent)', async () => {
    const provider = new MockEmailProvider();
    const kv = fakeKV();
    const env = { ...baseEnv, KV: kv as any };
    const event = {
      kind: 'payment_paid' as const, appId: 'app1', reference: 'REF1',
      email: 'x@y.com', amountLabel: '25.99 USD', dashboardUrl: 'https://d/app1',
    };
    await notifyTeam(env, event, provider);
    await notifyTeam(env, event, provider);
    expect(provider.sent).toHaveLength(1);
  });

  it('application_submitted: includes applications@ plus the team list', async () => {
    const provider = new MockEmailProvider();
    const kv = fakeKV();
    await notifyTeam({ ...baseEnv, KV: kv as any }, {
      kind: 'application_submitted', fullName: 'Ama Test',
      reference: 'REF2', dashboardUrl: 'https://d/app2',
    }, provider);

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toEqual(
      ['applications@missdiasporagh.org', ...TEAM_NOTIFY],
    );
    expect(provider.sent[0].category).toBe('application_submitted');
    expect(provider.sent[0].subject).toContain('[MDGH 📝 Application]');
  });
});
