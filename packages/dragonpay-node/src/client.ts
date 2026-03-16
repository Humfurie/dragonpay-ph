import type {
  DragonPayConfig,
  CreatePaymentInput,
  PaymentResult,
  TransactionStatus,
  PostbackParams,
  ProcessedPostback,
  CreatePayoutInput,
  PayoutResult,
  PayoutStatus,
  PayoutPostbackParams,
  ProcessedPayoutPostback,
  DragonPayPublicKey,
  Processor,
  DragonPayStatus,
} from './types';
import { COLLECT_URL_PRODUCTION, PAYOUT_URL_PRODUCTION } from './types';
import { createPayment, getTransactionStatus, cancelTransaction, getAvailableProcessors } from './collection';
import { createPayout as createPayoutFn, getPayoutStatus as getPayoutStatusFn } from './payout';
import {
  verifySha1Digest,
  verifyHmacSha256,
  verifyRsaSha256,
  verifyPayoutDigest,
  fetchPublicKeys,
} from './verification';
import { generateTxnId as genTxnId } from './utils';
import { mapProcessorCode as mapProcCode } from './processors';
import { DragonPayError } from './errors';

const KEY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export class DragonPayClient {
  private readonly merchantId: string;
  private readonly password: string;
  private readonly collectUrl: string;
  private readonly payoutPassword?: string;
  private readonly payoutUrl?: string;
  private readonly skipVerification: boolean;

  private cachedKeys: DragonPayPublicKey[] = [];
  private keysCachedAt = 0;

  constructor(config: DragonPayConfig) {
    this.merchantId = config.merchantId;
    this.password = config.password;
    this.collectUrl = config.collectUrl || COLLECT_URL_PRODUCTION;
    this.payoutPassword = config.payoutPassword;
    this.payoutUrl = config.payoutUrl;
    this.skipVerification = config.skipVerification || false;
  }

  // === Collection API ===

  async createPayment(txnId: string, input: CreatePaymentInput): Promise<PaymentResult> {
    return createPayment(txnId, input, this.merchantId, this.password, this.collectUrl);
  }

  async getTransactionStatus(txnId: string): Promise<TransactionStatus> {
    return getTransactionStatus(txnId, this.merchantId, this.password, this.collectUrl);
  }

  async cancelTransaction(txnId: string): Promise<{ status: string; message: string }> {
    return cancelTransaction(txnId, this.merchantId, this.password, this.collectUrl);
  }

  async getAvailableProcessors(amount: number): Promise<Processor[]> {
    return getAvailableProcessors(amount, this.merchantId, this.password, this.collectUrl);
  }

  // === Callback Verification ===

  async verifyPostback(callback: PostbackParams): Promise<ProcessedPostback> {
    let verified = false;

    if (this.skipVerification) {
      verified = true;
    } else if (callback.signatures) {
      const keys = await this.getPublicKeys();
      verified = verifyRsaSha256(callback, keys);
      if (!verified) {
        // Key rotation: refresh and retry
        const freshKeys = await this.getPublicKeys(true);
        verified = verifyRsaSha256(callback, freshKeys);
      }
    } else if (callback.signature) {
      verified = verifyHmacSha256(callback, this.password);
    } else if (callback.digest) {
      verified = verifySha1Digest(callback, this.password);
    }

    return {
      txnId: callback.txnid,
      refNo: callback.refno,
      status: callback.status as DragonPayStatus,
      message: callback.message,
      amount: callback.amount ? parseFloat(callback.amount) : undefined,
      currency: callback.ccy,
      procId: callback.procid,
      param1: callback.param1,
      param2: callback.param2,
      verified,
    };
  }

  async getPublicKeys(forceRefresh = false): Promise<DragonPayPublicKey[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedKeys.length > 0 && now - this.keysCachedAt < KEY_CACHE_TTL_MS) {
      return this.cachedKeys;
    }
    this.cachedKeys = await fetchPublicKeys(this.collectUrl, this.merchantId, this.password);
    this.keysCachedAt = Date.now();
    return this.cachedKeys;
  }

  verifyPayoutPostback(callback: PayoutPostbackParams): ProcessedPayoutPostback {
    const verified = this.skipVerification || verifyPayoutDigest(callback, this.password);
    return {
      txnId: callback.merchantTxnId,
      refNo: callback.refNo,
      status: callback.status as DragonPayStatus,
      message: callback.message,
      verified,
    };
  }

  // === Payout API ===

  async createPayout(txnId: string, input: CreatePayoutInput): Promise<PayoutResult> {
    if (!this.payoutPassword || !this.payoutUrl) {
      throw new DragonPayError('Payout credentials not configured');
    }
    return createPayoutFn(txnId, input, this.merchantId, this.payoutPassword, this.payoutUrl);
  }

  async getPayoutStatus(txnId: string): Promise<PayoutStatus> {
    if (!this.payoutPassword || !this.payoutUrl) {
      throw new DragonPayError('Payout credentials not configured');
    }
    return getPayoutStatusFn(txnId, this.merchantId, this.payoutPassword, this.payoutUrl);
  }

  // === Utilities ===

  generateTxnId(): string {
    return genTxnId();
  }

  mapProcessorCode(code: string): string | undefined {
    return mapProcCode(code);
  }
}
