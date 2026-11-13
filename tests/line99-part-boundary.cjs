const test = require('node:test');
const assert = require('node:assert/strict');
// Mirrors the narrow Apps Script whitelist deployed for the Line 99 pilot.
function allowed(machineId, part) {
  machineId = String(machineId); part = String(part);
  if (machineId === 'L99_AUTO_CHAMPER') return [
    'PIPE 1_BPA-E4742-0000-0335',
    'PIPE 1_BLS-E475A-0000-0305',
    'PIPE 1_DB2-E4741-0000-0635'
  ].includes(part);
  return /^L99_/.test(machineId) && /^BODY_DUMMY-[A-Z0-9-]+$/.test(part);
}
test('Only the three registered Champer parts enter the test machine', () => {
  for (const part of ['PIPE 1_BPA-E4742-0000-0335','PIPE 1_BLS-E475A-0000-0305','PIPE 1_DB2-E4741-0000-0635']) {
    assert.equal(allowed('L99_AUTO_CHAMPER',part),true);
    assert.equal(allowed('L1_AUTO_CHAMPER',part),false);
    assert.equal(allowed('L99_PRESS_DUMMY',part),false);
  }
  assert.equal(allowed('L99_AUTO_CHAMPER','PIPE 1_OTHER'),false);
  assert.equal(allowed('L99_AUTO_CHAMPER','BODY_DUMMY-PN99001'),false);
});
test('Existing dummy mappings retain compatibility', () => {
  assert.equal(allowed('L99_PRESS_DUMMY','BODY_DUMMY-PN99001'),true);
  assert.equal(allowed('L1_PRESS','BODY_DUMMY-PN99001'),false);
});
