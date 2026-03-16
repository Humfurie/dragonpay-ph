# @humfurie/dragonpay-nestjs

NestJS module for the [dragonpay-ph](../dragonpay-node) SDK. Provides `DragonPayService` as an injectable, fully-configured DragonPay client.

## Installation

```bash
npm install dragonpay-ph @humfurie/dragonpay-nestjs
```

## Quick Start

### Static Configuration (`forRoot`)

```typescript
import { Module } from '@nestjs/common';
import { DragonPayModule } from '@humfurie/dragonpay-nestjs';

@Module({
  imports: [
    DragonPayModule.forRoot({
      merchantId: process.env.DRAGONPAY_MERCHANT_ID!,
      password: process.env.DRAGONPAY_PASSWORD!,
      payoutPassword: process.env.DRAGONPAY_PAYOUT_PASSWORD,
      collectUrl: process.env.DRAGONPAY_SANDBOX === 'true'
        ? 'https://test.dragonpay.ph/api/collect/v2'
        : undefined,
    }),
  ],
})
export class AppModule {}
```

### Async Configuration (`forRootAsync`)

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DragonPayModule } from '@humfurie/dragonpay-nestjs';

@Module({
  imports: [
    DragonPayModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        merchantId: config.getOrThrow('DRAGONPAY_MERCHANT_ID'),
        password: config.getOrThrow('DRAGONPAY_PASSWORD'),
        payoutPassword: config.get('DRAGONPAY_PAYOUT_PASSWORD'),
        collectUrl: config.get('DRAGONPAY_SANDBOX') === 'true'
          ? 'https://test.dragonpay.ph/api/collect/v2'
          : undefined,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Usage

Inject `DragonPayService` anywhere in your application. It has the same API as `DragonPayClient` from `dragonpay-ph`.

```typescript
import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { DragonPayService } from '@humfurie/dragonpay-nestjs';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly dragonpay: DragonPayService) {}

  @Post()
  async createPayment(@Body() body: { orderId: string; amount: number; email: string }) {
    const txnId = this.dragonpay.generateTxnId();
    return this.dragonpay.createPayment(txnId, {
      amount: body.amount,
      description: `Order ${body.orderId}`,
      email: body.email,
      procId: 'GCSH',
    });
  }

  @Post('webhook')
  async handlePostback(@Body() body: Record<string, string>) {
    const result = await this.dragonpay.handlePostback(body);

    if (!result.verified) {
      throw new Error('Invalid postback signature');
    }

    // Update order status in your database
    // result.txnId, result.status, result.refNo, result.amount
    return 'OK';
  }

  @Get('return')
  handleReturn(@Query() query: Record<string, string>) {
    const result = this.dragonpay.parseReturnParams(query);
    // Show thank you / failure page based on result.status
    return result;
  }
}
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DRAGONPAY_MERCHANT_ID` | Yes | Your DragonPay merchant ID |
| `DRAGONPAY_PASSWORD` | Yes | Merchant password |
| `DRAGONPAY_PAYOUT_PASSWORD` | If using payouts | Payout API bearer token — **not available in the sandbox portal; contact DragonPay directly to request payout API credentials** |
| `DRAGONPAY_SANDBOX` | No | Set to `"true"` for sandbox URLs |

## API

`DragonPayService` extends `DragonPayClient` from `dragonpay-ph` and exposes all its methods:

| Method | Description |
|---|---|
| `createPayment(txnId, input)` | Create a payment request |
| `getTransactionStatus(txnId)` | Check transaction status |
| `cancelTransaction(txnId)` | Cancel a pending transaction |
| `getAvailableProcessors(amount)` | List available processors |
| `handlePostback(params)` | Verify + parse collection postback |
| `handlePayoutPostback(params)` | Verify + parse payout postback |
| `parseReturnParams(params)` | Parse return URL params (UX only) |
| `createPayout(txnId, input)` | Create a payout |
| `getPayoutStatus(txnId)` | Check payout status |
| `generateTxnId()` | Generate a unique transaction ID |
| `mapProcessorCode(code)` | Map processor name to DragonPay code |

See the [dragonpay-ph README](../dragonpay-node/README.md) for full documentation on each method, postback verification, status codes, and error handling.

## Module Behavior

- **Global module**: `DragonPayModule` is registered as global, so `DragonPayService` is available in all modules without re-importing.
- **Peer dependencies**: Requires `@nestjs/common` ^10 or ^11, `dragonpay-ph` >= 0.1.0, and `reflect-metadata`.

## License

MIT
