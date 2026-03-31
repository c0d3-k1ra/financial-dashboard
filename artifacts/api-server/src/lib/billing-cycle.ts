export function getCycleDates(month: string): { startDate: string; endDate: string } {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr);
  const mo = parseInt(monthStr);

  let prevMonth = mo - 1;
  let prevYear = year;
  if (prevMonth <= 0) {
    prevMonth = 12;
    prevYear--;
  }

  const startDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-25`;
  const endDate = `${year}-${String(mo).padStart(2, "0")}-24`;

  return { startDate, endDate };
}

export function generateCycleOptions(count: number = 12): { label: string; startDate: string; endDate: string; month: string }[] {
  const now = new Date();
  const results = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const { startDate, endDate } = getCycleDates(month);

    const startLabel = new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endLabel = new Date(endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    results.push({
      label: `${startLabel} – ${endLabel}`,
      startDate,
      endDate,
      month,
    });
  }

  return results;
}
