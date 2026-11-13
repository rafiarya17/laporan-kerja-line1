const {test}=require('node:test');
const assert=require('node:assert/strict');
const {sqlIntakeEnabled,sqlSubmissionEnabled}=require('../.test-build/sql-intake.js');
test('SQL intake stays off without explicit flags; pilot only routes Line 99',()=>{
  const keys=['VERCEL_ENV','DATABASE_URL','LKH_SQL_INTAKE','LKH_SQL_PREVIEW'];
  const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try {
    for(const k of keys) delete process.env[k];
    assert.equal(sqlIntakeEnabled(),false);
    process.env.DATABASE_URL='configured';process.env.VERCEL_ENV='production';
    assert.equal(sqlIntakeEnabled(),false);
    process.env.LKH_SQL_INTAKE='pilot';
    assert.equal(sqlSubmissionEnabled('LINE_99'),true);assert.equal(sqlSubmissionEnabled('LINE_1'),false);
    process.env.LKH_SQL_INTAKE='1';assert.equal(sqlSubmissionEnabled('LINE_1'),true);
    process.env.VERCEL_ENV='preview';assert.equal(sqlIntakeEnabled(),false);
    process.env.LKH_SQL_PREVIEW='1';assert.equal(sqlIntakeEnabled(),true);
  } finally {for(const k of keys){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}}
});
