export function validateAccountData(data: Record<string, any>): string | null {
  if (data.billingDueDay != null && (data.billingDueDay < 1 || data.billingDueDay > 31)) {
    return "billingDueDay must be between 1 and 31";
  }
  if (data.creditLimit != null && Number(data.creditLimit) < 0) {
    return "creditLimit must be non-negative.";
  }
  if (data.emiDay != null && (data.emiDay < 1 || data.emiDay > 31)) {
    return "emiDay must be between 1 and 31";
  }
  if (data.type === "loan") {
    if (!data.originalLoanAmount || Number(data.originalLoanAmount) <= 0) {
      return "Original loan amount is required and must be greater than zero.";
    }
    if (data.emiAmount != null && Number(data.emiAmount) <= 0) {
      return "EMI amount must be greater than zero.";
    }
    if (data.interestRate != null && Number(data.interestRate) < 0) {
      return "Interest rate must be non-negative.";
    }
    if (data.loanTenure != null && data.loanTenure < 1) {
      return "Loan tenure must be at least 1 month.";
    }
    if (data.emisPaid != null && data.emisPaid < 0) {
      return "EMIs paid must be non-negative.";
    }
  }
  return null;
}
