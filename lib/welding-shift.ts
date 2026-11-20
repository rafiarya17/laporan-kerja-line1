export function workShift(now: Date) {
  const local = new Date(now.getTime() + 7 * 3600000);
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const day = new Date(local.getTime() - (minute < 450 ? 86400000 : 0));
  return {date: day.toISOString().slice(0,10), shift: minute >= 450 && minute < 1170 ? 1 : 2};
}
