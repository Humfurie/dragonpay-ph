export function getCollectHeaders(merchantId: string, password: string): Record<string, string> {
  const credentials = Buffer.from(`${merchantId}:${password}`, 'utf-8').toString('base64');
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${credentials}`,
  };
}

export function getPayoutHeaders(payoutPassword: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${payoutPassword}`,
  };
}
