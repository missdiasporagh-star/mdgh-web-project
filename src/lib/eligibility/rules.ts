export const AGE_BANDS = ['Under 18', '18-25', '26-35', 'Over 35'] as const;
export type AgeBand = typeof AGE_BANDS[number];

export type EligibilityAnswers = {
  ageBand: AgeBand;
  isWoman: boolean;
  africanDescent: boolean;
  outsideGhana: boolean;
  validPassport: boolean;
};

export type DisqualifyingRule = 'age' | 'gender' | 'heritage' | 'residency' | 'passport';

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; disqualifyingRule: DisqualifyingRule };

export function evaluateEligibility(a: EligibilityAnswers): EligibilityResult {
  if (a.ageBand !== '18-25' && a.ageBand !== '26-35') return { eligible: false, disqualifyingRule: 'age' };
  if (!a.isWoman) return { eligible: false, disqualifyingRule: 'gender' };
  if (!a.africanDescent) return { eligible: false, disqualifyingRule: 'heritage' };
  if (!a.outsideGhana) return { eligible: false, disqualifyingRule: 'residency' };
  if (!a.validPassport) return { eligible: false, disqualifyingRule: 'passport' };
  return { eligible: true };
}
