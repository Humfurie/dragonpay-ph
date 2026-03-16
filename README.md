# dragonpay-ph

TypeScript SDK for the [DragonPay](https://www.dragonpay.ph/) payment gateway (Philippines). Supports Collection (accepting payments) and Payout (disbursements) APIs with full postback verification.

## Packages

This is a monorepo with two packages:

| Package | Description | npm |
|---|---|---|
| [`dragonpay-ph`](./packages/dragonpay-node) | Core SDK — zero dependencies, dual CJS/ESM | `npm install dragonpay-ph` |
| [`@dragonpay-ph/nestjs`](./packages/dragonpay-nestjs) | NestJS module wrapper | `npm install dragonpay-ph @dragonpay-ph/nestjs` |

## Quick Start

```bash
npm install dragonpay-ph
```

```typescript
import { DragonPayClient } from 'dragonpay-ph';

const client = new DragonPayClient({
  merchantId: process.env.DRAGONPAY_MERCHANT_ID!,
  password: process.env.DRAGONPAY_PASSWORD!,
});

const payment = await client.createPayment('ORDER-001', {
  amount: 1500,
  description: 'Premium subscription',
  email: 'juan@example.com',
  procId: 'GCSH', // GCash
});

// Redirect the customer to payment.url
```

## Credentials

You need a DragonPay merchant account. Sign up at [dragonpay.ph](https://www.dragonpay.ph/) (requires a registered Philippine business).

| Credential | Where to get it | Used for |
|---|---|---|
| Merchant ID | DragonPay merchant portal | All API calls |
| Password | DragonPay merchant portal | Collection API (Basic Auth) + postback verification |
| Payout Password | **Contact DragonPay directly** — not available in the sandbox portal | Payout API (Bearer token) |

### `.env`

```env
DRAGONPAY_MERCHANT_ID=your_merchant_id
DRAGONPAY_PASSWORD=your_password

# Only if using payouts (request from DragonPay)
DRAGONPAY_PAYOUT_PASSWORD=your_payout_token
```

**No DragonPay account yet?** Use the built-in mock server to develop locally without credentials:

```typescript
import { createMockServer } from 'dragonpay-ph/mock';

const mock = createMockServer({ port: 4010 });
await mock.start();
// http://localhost:4010 — dashboard with all mock endpoints
```

## Features

- **Collection API** — create payments, check status, cancel, list processors
- **Payout API** — create payouts, check status
- **Postback verification** — SHA1, HMAC-SHA256, RSA-SHA256 (with key rotation)
- **Return URL parsing** — for browser redirects after payment
- **Mock server** — full local mock at `dragonpay-ph/mock` for development
- **Production hardened** — input validation, request timeouts, retries with exponential backoff, safe JSON parsing
- **Zero runtime dependencies** — uses native `fetch` and `crypto` (Node 18+)
- **Dual CJS/ESM** — works with `import` and `require`

## Supported Processors

GCash, Maya, GrabPay, ShopeePay, BPI, BDO, UnionBank, Metrobank, InstaPay, PESONet, 7-Eleven, Bayad, Cebuana, M Lhuillier, ECPay, Credit Card, Bank Transfer.

## Development

```bash
# Install dependencies
npm install

# Run tests (all packages)
npm test --workspaces

# Build (all packages)
npm run build --workspaces

# Typecheck (all packages)
npm run typecheck --workspaces

# Run the demo (mock server + webhook + SDK)
cd packages/dragonpay-node
npx tsx examples/demo.ts
```

## Project Structure

```
packages/
  dragonpay-node/       # Core SDK (dragonpay-ph on npm)
    src/
      client.ts         # DragonPayClient — main entry point
      collection.ts     # Collection API calls
      payout.ts         # Payout API calls
      verification.ts   # Postback signature verification
      request.ts        # HTTP layer (timeout, retry, safe parsing)
      validate.ts       # Input validation
      processors.ts     # Processor code mapping
      mock-server.ts    # Local mock server
      types.ts          # All TypeScript interfaces
      errors.ts         # Error classes
    examples/
      demo.ts           # Full working demo
    tests/              # 103 tests across 13 files

  dragonpay-nestjs/     # NestJS wrapper (@dragonpay-ph/nestjs on npm)
    src/
      dragonpay.module.ts    # forRoot / forRootAsync
      dragonpay.service.ts   # Injectable DragonPayClient
    tests/
```

## Documentation

- [Core SDK README](./packages/dragonpay-node/README.md) — full API docs, postback handling, error handling, mock server
- [NestJS README](./packages/dragonpay-nestjs/README.md) — module setup, controller examples

## License

MIT
