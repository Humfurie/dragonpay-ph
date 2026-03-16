export function generateTxnId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${timestamp}-${random}`;
}

export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}
