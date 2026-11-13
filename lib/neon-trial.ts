import type { Master } from './lkh';
export const trialMaster: Master = {
  LINE_99: {
    operators: ['OPERATOR TEST A', 'OPERATOR TEST B', 'HELPER TEST B', '__other_option__'],
    mesin_part_mapping: {'PRESS DUMMY': {options: ['BODY_DUMMY-PN99001', 'BODY_DUMMY-PN99002']}},
  },
};
export function neonTrialEnabled() {
  return process.env.VERCEL_ENV === 'preview' && Boolean(process.env.DATABASE_URL);
}
