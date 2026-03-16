// === Configuration ===

export interface DragonPayConfig {
  merchantId: string;
  password: string;
  /** Base URL for Collection API. Default: production URL */
  collectUrl?: string;
  /** Password for Payout API (different from collection password) */
  payoutPassword?: string;
  /** Base URL for Payout API */
  payoutUrl?: string;
  /** Enable mock mode for local development */
  mock?: boolean;
  /** Skip signature verification (development only) */
  skipVerification?: boolean;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Max retries on network errors and 5xx responses (default: 2) */
  maxRetries?: number;
}

// === Collection API ===

export interface CreatePaymentInput {
  amount: number;
  currency?: string;
  description: string;
  email: string;
  /** Processor ID — required in V2 to lock the payment channel */
  procId?: string;
  /** Pass-through parameter returned in callback */
  param1?: string;
  /** Pass-through parameter returned in callback */
  param2?: string;
  /** ISO datetime string for payment expiry */
  expiry?: string;
  ipAddress?: string;
  userAgent?: string;
  billingDetails?: BillingDetails;
}

export interface BillingDetails {
  firstName?: string;
  lastName?: string;
  address1?: string;
  city?: string;
  /** Maps to 'Province' in DragonPay's API */
  state?: string;
  country?: string;
  zipCode?: string;
  telNo?: string;
  email?: string;
}

export interface PaymentResult {
  txnId: string;
  refNo: string;
  status: string;
  message: string;
  url: string;
}

export interface TransactionStatus {
  txnId: string;
  refNo: string;
  status: DragonPayStatus;
  message: string;
}

// === Postback Callback ===

export interface PostbackParams {
  txnid: string;
  refno: string;
  status: string;
  message: string;
  digest?: string;
  signature?: string;
  signatures?: string;
  merchantid?: string;
  param1?: string;
  param2?: string;
  amount?: string;
  ccy?: string;
  procid?: string;
  settledate?: string;
}

export interface ProcessedPostback {
  txnId: string;
  refNo: string;
  status: DragonPayStatus;
  message: string;
  amount?: number;
  currency?: string;
  procId?: string;
  param1?: string;
  param2?: string;
  verified: boolean;
}

// === Payout API ===

export interface CreatePayoutInput {
  firstName: string;
  lastName: string;
  amount: number;
  currency?: string;
  description: string;
  email: string;
  /** Payout processor ID (e.g., 'BOG' for bank, 'GCSH' for GCash) */
  procId: string;
  /** Account number or mobile number for payout */
  procDetail: string;
  /** ISO date string (YYYY-MM-DD). Defaults to today. */
  runDate?: string;
}

export interface PayoutResult {
  txnId: string;
  refNo: string;
  status: string;
  message: string;
}

export interface PayoutStatus {
  txnId: string;
  refNo: string;
  status: string;
  message: string;
}

export interface PayoutPostbackParams {
  merchantTxnId: string;
  refNo: string;
  status: string;
  message: string;
  digest?: string;
}

export interface ProcessedPayoutPostback {
  txnId: string;
  refNo: string;
  status: DragonPayStatus;
  message: string;
  verified: boolean;
}

// === Public Keys ===

export interface DragonPayPublicKey {
  value: string;
  status: 'Active' | 'Revoked';
}

// === Processors ===

export interface Processor {
  procId: string;
  shortName: string;
  longName: string;
  logo: string;
  currencies: string[];
  minAmount: number;
  maxAmount: number;
}

// === Status Enum ===

export type DragonPayStatus = 'S' | 'F' | 'P' | 'U' | 'V' | 'Q' | 'R' | 'K';

export const DRAGONPAY_STATUS = {
  SUCCESS: 'S' as DragonPayStatus,
  FAILURE: 'F' as DragonPayStatus,
  PENDING: 'P' as DragonPayStatus,
  UNKNOWN: 'U' as DragonPayStatus,
  VOID: 'V' as DragonPayStatus,
  QUEUED: 'Q' as DragonPayStatus,
  REFUND: 'R' as DragonPayStatus,
  CHARGEBACK: 'K' as DragonPayStatus,
} as const;

// === Internal ===

export const COLLECT_URL_PRODUCTION = 'https://gw.dragonpay.ph/api/collect/v2';
export const COLLECT_URL_SANDBOX = 'https://test.dragonpay.ph/api/collect/v2';
export const PAYOUT_URL_PRODUCTION = 'https://gw.dragonpay.ph/api/payout/merchant/v1';
export const PAYOUT_URL_SANDBOX = 'https://test.dragonpay.ph/api/payout/merchant/v1';
