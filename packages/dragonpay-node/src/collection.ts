import type { CreatePaymentInput, PaymentResult, TransactionStatus, Processor } from './types';
import { getCollectHeaders } from './auth';
import { DragonPayError } from './errors';
import { formatAmount } from './utils';

export async function createPayment(
  txnId: string,
  input: CreatePaymentInput,
  merchantId: string,
  password: string,
  baseUrl: string,
): Promise<PaymentResult> {
  const url = `${baseUrl}/${txnId}/post`;

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

  const response = await fetch(url, {
    method: 'POST',
    headers: getCollectHeaders(merchantId, password),
    body: JSON.stringify(payload),
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
    url: data.Url,
  };
}

export async function getTransactionStatus(
  txnId: string,
  merchantId: string,
  password: string,
  baseUrl: string,
): Promise<TransactionStatus> {
  const response = await fetch(`${baseUrl}/${txnId}`, {
    method: 'GET',
    headers: getCollectHeaders(merchantId, password),
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

export async function cancelTransaction(
  txnId: string,
  merchantId: string,
  password: string,
  baseUrl: string,
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${baseUrl}/${txnId}/void`, {
    method: 'GET',
    headers: getCollectHeaders(merchantId, password),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new DragonPayError(data.Message || `HTTP ${response.status}`, data.Status, data.Message);
  }

  return { status: data.Status, message: data.Message };
}

export async function getAvailableProcessors(
  amount: number,
  merchantId: string,
  password: string,
  baseUrl: string,
): Promise<Processor[]> {
  const response = await fetch(`${baseUrl}/processors/${formatAmount(amount)}`, {
    method: 'GET',
    headers: getCollectHeaders(merchantId, password),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new DragonPayError(data.Message || `HTTP ${response.status}`, data.Status, data.Message);
  }

  return data.map((p: Record<string, unknown>) => ({
    procId: p.ProcId,
    shortName: p.ShortName,
    longName: p.LongName,
    logo: p.Logo,
    currencies: p.Currencies,
    minAmount: p.MinAmount,
    maxAmount: p.MaxAmount,
  }));
}
