const fields = ['date','shift','line','machine','part','unit','reports','ok','repair','reject','plan','quality','performance','eff','availability','oee'];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const catalogName = (v:unknown) => typeof v === 'string' && v.length > 0 && v.length <= 200;

// Fail closed if a source change introduces columns outside the public projection.
export function publicWeldingMart(value:Record<string,unknown>) {
  const {start,end,captured,machines,parts} = value;
  if (JSON.stringify(value.fields) !== JSON.stringify(fields) ||
      typeof start !== 'string' || !datePattern.test(start) || typeof end !== 'string' || !datePattern.test(end) ||
      typeof captured !== 'string' || !Number.isFinite(Date.parse(captured)) || start > end) throw Error('INVALID_MART');
  function validRow(r:unknown) {
    return Array.isArray(r) && r.length === fields.length && typeof r[0] === 'string' && datePattern.test(r[0]) &&
      [1,2].includes(r[1]) && Number.isInteger(r[2]) && r[2] >= 1 && r[2] <= 8 &&
      catalogName(r[3]) && (r[4] === null || catalogName(r[4])) && (r[5] === null || catalogName(r[5])) &&
      r.slice(6).every(n=>n===null || Number.isFinite(n));
  }
  if (!Array.isArray(machines) || !Array.isArray(parts) || !machines.every(validRow) || !parts.every(validRow)) throw Error('INVALID_MART');
  return {start,end,captured,fields,machines,parts};
}
