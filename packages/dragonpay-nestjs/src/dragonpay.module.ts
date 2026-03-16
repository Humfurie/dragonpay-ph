import { DynamicModule, Module } from '@nestjs/common';
import type { DragonPayConfig } from 'dragonpay-ph';
import { DragonPayService } from './dragonpay.service';
import { DRAGONPAY_OPTIONS } from './dragonpay.constants';
import type { DragonPayModuleAsyncOptions } from './dragonpay.interfaces';

@Module({})
export class DragonPayModule {
  static forRoot(config: DragonPayConfig): DynamicModule {
    return {
      module: DragonPayModule,
      global: true,
      providers: [
        { provide: DRAGONPAY_OPTIONS, useValue: config },
        DragonPayService,
      ],
      exports: [DragonPayService],
    };
  }

  static forRootAsync(options: DragonPayModuleAsyncOptions): DynamicModule {
    return {
      module: DragonPayModule,
      global: true,
      imports: options.imports || [],
      providers: [
        {
          provide: DRAGONPAY_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        DragonPayService,
      ],
      exports: [DragonPayService],
    };
  }
}
