import type { CreatePayoutInput, PayoutResult, PayoutStatus } from './types';
import { getPayoutHeaders } from './auth';
import { DragonPayError } from './errors';
import { formatAmount } from './utils';

export async function createPayout(
  txnId: string,
  input: CreatePayoutInput,
  merchantId: string,
  payoutPassword: string,
  payoutUrl: string,
): Promise<PayoutResult> {
  const url = `${payoutUrl}/${merchantId}/post`;

  const payload = {
    TxnId: txnId,
    FirstName: input.firstName,
    LastName: input.lastName,
    Amount: formatAmount(input.amount),
    Currency: input.currency || 'PHP',
    Description: input.description,
    ProcId: input.procId,
    ProcDetail: input.procDetail,
    RunDate: input.runDate || new Date().toISOString().slice(0, 10),
    Email: input.email,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: getPayoutHeaders(payoutPassword),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new DragonPayError(errorData.Message || `HTTP ${response.status}`, response.status, errorData.Message);
  }

  const data = await response.json();

  // Code 0 = queued. Message field IS the reference number.
  if (data.Code !== 0) {
    throw new DragonPayError(data.Message || `Payout failed with code ${data.Code}`, data.Code, data.Message);
  }

  return {
    txnId,
    refNo: data.Message,
    status: 'Q',
    message: `Payout submitted: ${data.Message}`,
  };
}

export async function getPayoutStatus(
  txnId: string,
  merchantId: string,
  payoutPassword: string,
  payoutUrl: string,
): Promise<PayoutStatus> {
  const response = await fetch(`${payoutUrl}/${merchantId}/${txnId}`, {
    method: 'GET',
    headers: getPayoutHeaders(payoutPassword),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new DragonPayError(data.Message || `HTTP ${response.status}`, data.Status, data.Message);
  }

  return {
    txnId,
    refNo: data.RefNo,
    status: data.Status,
    message: data.Message,
  };
}
