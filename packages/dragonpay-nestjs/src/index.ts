export { DragonPayModule } from './dragonpay.module';
export { DragonPayService } from './dragonpay.service';
export { DRAGONPAY_OPTIONS } from './dragonpay.constants';
export type { DragonPayModuleAsyncOptions } from './dragonpay.interfaces';

// Re-export core types so consumers don't need to install dragonpay-ph separately for types
export type {
  DragonPayConfig,
  CreatePaymentInput,
  PaymentResult,
  TransactionStatus,
  PostbackParams,
  ProcessedPostback,
  CreatePayoutInput,
  PayoutAddress,
  PayoutResult,
  PayoutStatus,
  PayoutPostbackParams,
  ProcessedPayoutPostback,
  DragonPayStatus,
  Processor,
} from 'dragonpay-ph';

export {
  DRAGONPAY_STATUS,
  DragonPayError,
  COLLECT_URL_PRODUCTION,
  COLLECT_URL_SANDBOX,
  PAYOUT_URL_PRODUCTION,
  PAYOUT_URL_SANDBOX,
} from 'dragonpay-ph';
