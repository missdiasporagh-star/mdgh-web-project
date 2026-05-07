import { describe, it, expect } from 'vitest';
import { evaluateEligibility, AGE_BANDS, type EligibilityAnswers } from '@/lib/eligibility/rules';

const VALID: EligibilityAnswers = {
  ageBand: '18-25',
  isWoman: true,
  africanDescent: true,
  outsideGhana: true,
  validPassport: true,
};

describe('evaluateEligibility', () => {
  it('passes when all 5 rules satisfied', () => {
    const result = evaluateEligibility(VALID);
    expect(result.eligible).toBe(true);
  });

  it('fails on age out-of-range — Under 18', () => {
    const result = evaluateEligibility({ ...VALID, ageBand: 'Under 18' });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('age');
  });

  it('fails on age out-of-range — Over 35', () => {
    const result = evaluateEligibility({ ...VALID, ageBand: 'Over 35' });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('age');
  });

  it('fails on isWoman = false', () => {
    const result = evaluateEligibility({ ...VALID, isWoman: false });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('gender');
  });

  it('fails on africanDescent = false', () => {
    const result = evaluateEligibility({ ...VALID, africanDescent: false });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('heritage');
  });

  it('fails on outsideGhana = false', () => {
    const result = evaluateEligibility({ ...VALID, outsideGhana: false });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('residency');
  });

  it('fails on validPassport = false', () => {
    const result = evaluateEligibility({ ...VALID, validPassport: false });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('passport');
  });

  it('returns first failure when multiple rules fail', () => {
    const result = evaluateEligibility({ ...VALID, isWoman: false, africanDescent: false });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.disqualifyingRule).toBe('gender');
  });

  it('AGE_BANDS exposes the four canonical bands in order', () => {
    expect(AGE_BANDS).toEqual(['Under 18', '18-25', '26-35', 'Over 35']);
  });
});
