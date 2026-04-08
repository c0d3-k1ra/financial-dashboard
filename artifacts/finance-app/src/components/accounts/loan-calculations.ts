export function calculateEmi(principal: number, annualRate: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  if (annualRate <= 0) return Math.ceil(principal / tenureMonths);
  const r = annualRate / 100 / 12;
  const emi = principal * r * Math.pow(1 + r, tenureMonths) / (Math.pow(1 + r, tenureMonths) - 1);
  return Math.ceil(emi);
}

export function calculateEmisPaid(loanStartDate: string, emiDay: number): number {
  if (!loanStartDate || !emiDay) return 0;
  const start = new Date(loanStartDate);
  const now = new Date();
  let firstEmiYear = start.getFullYear();
  let firstEmiMonth = start.getMonth() + 1;
  if (firstEmiMonth > 11) {
    firstEmiYear += Math.floor(firstEmiMonth / 12);
    firstEmiMonth = firstEmiMonth % 12;
  }
  const firstEmi = new Date(firstEmiYear, firstEmiMonth, emiDay);
  if (now < firstEmi) return 0;
  let months = (now.getFullYear() - firstEmi.getFullYear()) * 12 + (now.getMonth() - firstEmi.getMonth());
  if (now.getDate() >= emiDay) {
    months += 1;
  }
  return Math.max(0, months);
}

export function calculateOutstandingPrincipal(principal: number, annualRate: number, tenureMonths: number, emisPaid: number): number {
  if (principal <= 0 || tenureMonths <= 0 || emisPaid <= 0) return principal;
  if (emisPaid >= tenureMonths) return 0;
  if (annualRate <= 0) return Math.max(0, principal - (principal / tenureMonths) * emisPaid);
  const r = annualRate / 100 / 12;
  const outstanding = principal * Math.pow(1 + r, emisPaid) - (principal * r * Math.pow(1 + r, tenureMonths) / (Math.pow(1 + r, tenureMonths) - 1)) * (Math.pow(1 + r, emisPaid) - 1) / r;
  return Math.max(0, Math.round(outstanding * 100) / 100);
}
