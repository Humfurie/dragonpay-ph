import { Inject, Injectable } from '@nestjs/common';
import { DragonPayClient } from 'dragonpay-ph';
import type { DragonPayConfig } from 'dragonpay-ph';
import { DRAGONPAY_OPTIONS } from './dragonpay.constants';

@Injectable()
export class DragonPayService extends DragonPayClient {
  constructor(@Inject(DRAGONPAY_OPTIONS) config: DragonPayConfig) {
    super(config);
  }
}
