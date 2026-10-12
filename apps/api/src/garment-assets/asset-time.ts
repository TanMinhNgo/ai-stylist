export function assetDay(now = new Date()) {
  const day = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  return {
    day,
    resetAt: new Date(new Date(`${day}T00:00:00+07:00`).getTime() + 86400000),
  };
}
