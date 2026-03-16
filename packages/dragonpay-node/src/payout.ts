import type { CreatePayoutInput, PayoutResult, PayoutStatus } from './types';
import { getPayoutHeaders } from './auth';
import { DragonPayError } from './errors';
import { formatAmount } from './utils';
import { safeRequest } from './request';

export interface PayoutRequestConfig {
  merchantId: string;
  payoutPassword: string;
  payoutUrl: string;
  timeoutMs: number;
  maxRetries: number;
}

export async function createPayout(
  txnId: string,
  input: CreatePayoutInput,
  config: PayoutRequestConfig,
): Promise<PayoutResult> {
  const url = `${config.payoutUrl}/${config.merchantId}/post`;

  const payload: Record<string, unknown> = {
    TxnId: txnId,
    FirstName: input.firstName,
    MiddleName: input.middleName || '',
    LastName: input.lastName,
    Amount: formatAmount(input.amount),
    Currency: input.currency || 'PHP',
    Description: input.description,
    ProcId: input.procId,
    ProcDetail: input.procDetail,
    RunDate: input.runDate || new Date().toISOString().slice(0, 10),
    Email: input.email,
    MobileNo: input.mobileNo || '',
    BirthDate: input.birthDate || '',
    Nationality: input.nationality || '',
  };

  if (input.address) {
    const addr = input.address;
    payload.Address = {
      ...(addr.street1 && { Street1: addr.street1 }),
      ...(addr.street2 && { Street2: addr.street2 }),
      ...(addr.barangay && { Barangay: addr.barangay }),
      ...(addr.city && { City: addr.city }),
      ...(addr.province && { Province: addr.province }),
      ...(addr.country && { Country: addr.country }),
    };
  }

  const { data, status } = await safeRequest<Record<string, unknown>>({
    url,
    method: 'POST',
    headers: getPayoutHeaders(config.payoutPassword),
    body: JSON.stringify(payload),
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  });

  if (status >= 400) {
    throw new DragonPayError(
      (data.Message as string) || `HTTP ${status}`,
      status,
      data.Message as string,
    );
  }

  // Code 0 = queued. Message field IS the reference number.
  if (data.Code !== 0) {
    throw new DragonPayError(
      (data.Message as string) || `Payout failed with code ${data.Code}`,
      data.Code as number,
      data.Message as string,
    );
  }

  return {
    txnId,
    refNo: data.Message as string,
    status: 'Q',
    message: `Payout submitted: ${data.Message}`,
  };
}

export async function getPayoutStatus(
  txnId: string,
  config: PayoutRequestConfig,
): Promise<PayoutStatus> {
  const { data, status } = await safeRequest<Record<string, string>>({
    url: `${config.payoutUrl}/${config.merchantId}/${txnId}`,
    method: 'GET',
    headers: getPayoutHeaders(config.payoutPassword),
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  });

  if (status >= 400) {
    throw new DragonPayError(data.Message || `HTTP ${status}`, Number(data.Status), data.Message);
  }

  return {
    txnId,
    refNo: data.RefNo,
    status: data.Status,
    message: data.Message,
  };
}
