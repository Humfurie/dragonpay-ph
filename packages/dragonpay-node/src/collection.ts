import type { CreatePaymentInput, PaymentResult, TransactionStatus, Processor } from './types';
import { getCollectHeaders } from './auth';
import { DragonPayError } from './errors';
import { formatAmount } from './utils';
import { safeRequest } from './request';

export interface CollectRequestConfig {
  merchantId: string;
  password: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
}

export async function createPayment(
  txnId: string,
  input: CreatePaymentInput,
  config: CollectRequestConfig,
): Promise<PaymentResult> {
  const url = `${config.baseUrl}/${txnId}/post`;

  const payload: Record<string, unknown> = {
    Amount: formatAmount(input.amount),
    Currency: input.currency || 'PHP',
    Description: input.description,
    Email: input.email,
  };

  if (input.procId) payload.ProcId = input.procId;
  if (input.param1) payload.Param1 = input.param1;
  if (input.param2) payload.Param2 = input.param2;
  if (input.expiry) payload.Expiry = input.expiry;
  if (input.ipAddress) payload.IpAddress = input.ipAddress;
  if (input.userAgent) payload.UserAgent = input.userAgent;

  if (input.billingDetails) {
    const bd = input.billingDetails;
    payload.BillingDetails = {
      ...(bd.firstName && { FirstName: bd.firstName }),
      ...(bd.lastName && { LastName: bd.lastName }),
      ...(bd.address1 && { Address1: bd.address1 }),
      ...(bd.city && { City: bd.city }),
      ...(bd.state && { Province: bd.state }),
      ...(bd.country && { Country: bd.country }),
      ...(bd.zipCode && { ZipCode: bd.zipCode }),
      ...(bd.telNo && { TelNo: bd.telNo }),
      ...(bd.email && { Email: bd.email }),
    };
  }

  const { data, status } = await safeRequest<Record<string, string>>({
    url,
    method: 'POST',
    headers: getCollectHeaders(config.merchantId, config.password),
    body: JSON.stringify(payload),
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
    url: data.Url,
  };
}

export async function getTransactionStatus(
  txnId: string,
  config: CollectRequestConfig,
): Promise<TransactionStatus> {
  const { data, status } = await safeRequest<Record<string, string>>({
    url: `${config.baseUrl}/${txnId}`,
    method: 'GET',
    headers: getCollectHeaders(config.merchantId, config.password),
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  });

  if (status >= 400) {
    throw new DragonPayError(data.Message || `HTTP ${status}`, Number(data.Status), data.Message);
  }

  return {
    txnId,
    refNo: data.RefNo,
    status: data.Status as any,
    message: data.Message,
  };
}

export async function cancelTransaction(
  txnId: string,
  config: CollectRequestConfig,
): Promise<{ status: string; message: string }> {
  const { data, status } = await safeRequest<Record<string, string>>({
    url: `${config.baseUrl}/${txnId}/void`,
    method: 'GET',
    headers: getCollectHeaders(config.merchantId, config.password),
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  });

  if (status >= 400) {
    throw new DragonPayError(data.Message || `HTTP ${status}`, Number(data.Status), data.Message);
  }

  return { status: data.Status, message: data.Message };
}

export async function getAvailableProcessors(
  amount: number,
  config: CollectRequestConfig,
): Promise<Processor[]> {
  const { data, status } = await safeRequest<Record<string, unknown>[]>({
    url: `${config.baseUrl}/processors/${formatAmount(amount)}`,
    method: 'GET',
    headers: getCollectHeaders(config.merchantId, config.password),
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  });

  if (status >= 400) {
    const err = data as unknown as Record<string, string>;
    throw new DragonPayError(err.Message || `HTTP ${status}`, Number(err.Status), err.Message);
  }

  return (data as Record<string, unknown>[]).map((p) => ({
    procId: p.ProcId as string,
    shortName: p.ShortName as string,
    longName: p.LongName as string,
    logo: p.Logo as string,
    currencies: p.Currencies as string[],
    minAmount: p.MinAmount as number,
    maxAmount: p.MaxAmount as number,
  }));
}
