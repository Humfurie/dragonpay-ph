import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { DragonPayModule } from '../src/dragonpay.module';
import { DragonPayService } from '../src/dragonpay.service';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockOk(body: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

describe('DragonPayModule', () => {
  it('forRoot provides DragonPayService', async () => {
    const module = await Test.createTestingModule({
      imports: [
        DragonPayModule.forRoot({
          merchantId: 'TEST',
          password: 'secret',
          maxRetries: 0,
        }),
      ],
    }).compile();

    const service = module.get(DragonPayService);
    expect(service).toBeInstanceOf(DragonPayService);
  });

  it('forRootAsync provides DragonPayService via factory', async () => {
    const module = await Test.createTestingModule({
      imports: [
        DragonPayModule.forRootAsync({
          useFactory: () => ({
            merchantId: 'ASYNC_TEST',
            password: 'async_secret',
            maxRetries: 0,
          }),
        }),
      ],
    }).compile();

    const service = module.get(DragonPayService);
    expect(service).toBeInstanceOf(DragonPayService);
  });

  it('service has all DragonPayClient methods', async () => {
    const module = await Test.createTestingModule({
      imports: [
        DragonPayModule.forRoot({
          merchantId: 'TEST',
          password: 'secret',
          maxRetries: 0,
        }),
      ],
    }).compile();

    const service = module.get(DragonPayService);

    expect(typeof service.createPayment).toBe('function');
    expect(typeof service.getTransactionStatus).toBe('function');
    expect(typeof service.cancelTransaction).toBe('function');
    expect(typeof service.getAvailableProcessors).toBe('function');
    expect(typeof service.handlePostback).toBe('function');
    expect(typeof service.createPayout).toBe('function');
    expect(typeof service.verifyPostback).toBe('function');
    expect(typeof service.generateTxnId).toBe('function');
    expect(typeof service.mapProcessorCode).toBe('function');
  });

  it('service can create a payment', async () => {
    mockFetch.mockResolvedValueOnce(mockOk({
      RefNo: 'REF1', Status: 'S', Message: 'OK', Url: 'https://pay.dragonpay.ph/x',
    }));

    const module = await Test.createTestingModule({
      imports: [
        DragonPayModule.forRoot({
          merchantId: 'TEST',
          password: 'secret',
          maxRetries: 0,
        }),
      ],
    }).compile();

    const service = module.get(DragonPayService);
    const result = await service.createPayment('TXN-NEST-1', {
      amount: 100,
      description: 'NestJS test',
      email: 'test@test.com',
    });

    expect(result.txnId).toBe('TXN-NEST-1');
    expect(result.refNo).toBe('REF1');
  });
});
