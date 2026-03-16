import { DragonPayError } from './errors';
import type { CreatePaymentInput, CreatePayoutInput } from './types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TXNID_LENGTH = 40;

export function validateTxnId(txnId: string): void {
  if (!txnId || txnId.trim().length === 0) {
    throw new DragonPayError('txnId is required');
  }
  if (txnId.length > MAX_TXNID_LENGTH) {
    throw new DragonPayError(`txnId must be ${MAX_TXNID_LENGTH} characters or less (got ${txnId.length})`);
  }
}

export function validatePaymentInput(input: CreatePaymentInput): void {
  if (input.amount <= 0) {
    throw new DragonPayError('amount must be greater than 0');
  }
  if (!input.description || input.description.trim().length === 0) {
    throw new DragonPayError('description is required');
  }
  if (!input.email || !EMAIL_REGEX.test(input.email)) {
    throw new DragonPayError('a valid email is required');
  }
}

export function validatePayoutInput(input: CreatePayoutInput): void {
  if (input.amount <= 0) {
    throw new DragonPayError('amount must be greater than 0');
  }
  if (!input.firstName || input.firstName.trim().length === 0) {
    throw new DragonPayError('firstName is required');
  }
  if (!input.lastName || input.lastName.trim().length === 0) {
    throw new DragonPayError('lastName is required');
  }
  if (!input.email || !EMAIL_REGEX.test(input.email)) {
    throw new DragonPayError('a valid email is required');
  }
  if (!input.procId || input.procId.trim().length === 0) {
    throw new DragonPayError('procId is required for payouts');
  }
  if (!input.procDetail || input.procDetail.trim().length === 0) {
    throw new DragonPayError('procDetail (account number) is required for payouts');
  }
}
