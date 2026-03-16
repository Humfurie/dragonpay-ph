# dragonpay-ph

Production-grade TypeScript SDK for the [DragonPay](https://www.dragonpay.ph/) payment gateway (Philippines). Supports both Collection (accepting payments) and Payout (disbursements) APIs with full postback verification.

## Features

- Collection API (create payments, check status, cancel, list processors)
- Payout API (create payouts, check status)
- Postback verification (SHA1, HMAC-SHA256, RSA-SHA256 with key rotation)
- Return URL parsing for browser redirects
- Built-in input validation and error handling
- Automatic retries with exponential backoff on 5xx/network errors
- Request timeouts via `AbortSignal`
- Zero runtime dependencies (uses native `fetch` and `crypto`)
- Dual CJS/ESM build
- Mock server for local development (`dragonpay-ph/mock`)

## Requirements

- Node.js >= 18.0.0

## Installation

```bash
npm install dragonpay-ph
```

## Quick Start

```typescript
import { DragonPayClient } from 'dragonpay-ph';

const client = new DragonPayClient({
  merchantId: process.env.DRAGONPAY_MERCHANT_ID!,
  password: process.env.DRAGONPAY_PASSWORD!,
});

// Create a payment
const txnId = client.generateTxnId();
const payment = await client.createPayment(txnId, {
  amount: 1500,
  description: 'Premium subscription',
  email: 'juan@example.com',
  procId: 'GCSH', // GCash
});

console.log(payment.url); // Redirect the customer here
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DRAGONPAY_MERCHANT_ID` | Yes | Your DragonPay merchant ID |
| `DRAGONPAY_PASSWORD` | Yes | Merchant password (Collection API + postback verification) |
| `DRAGONPAY_PAYOUT_PASSWORD` | If using payouts | Payout API bearer token — **not available in the sandbox portal; contact DragonPay directly to request payout API credentials** |

## Configuration

```typescript
const client = new DragonPayClient({
  // Required
  merchantId: 'YOUR_MERCHANT_ID',
  password: 'YOUR_PASSWORD',

  // Optional — Payout API (separate credentials, request from DragonPay)
  payoutPassword: 'YOUR_PAYOUT_TOKEN',

  // Optional — URL overrides (defaults to production)
  collectUrl: 'https://test.dragonpay.ph/api/collect/v2',   // sandbox
  payoutUrl: 'https://test.dragonpay.ph/api/payout/merchant/v1', // sandbox

  // Optional — tuning
  timeoutMs: 30000,   // request timeout (default: 30s)
  maxRetries: 2,      // retries on 5xx/network errors (default: 2)

  // Optional — development
  skipVerification: false, // skip postback signature verification
});
```

## Collection API

### Create a Payment

```typescript
const txnId = client.generateTxnId();
const payment = await client.createPayment(txnId, {
  amount: 1500.00,
  description: 'Premium subscription',
  email: 'juan@example.com',
  procId: 'GCSH',           // optional — locks to a specific processor
  currency: 'PHP',          // optional, default: PHP
  param1: 'custom-data',    // optional — returned in postback
  param2: 'more-data',      // optional — returned in postback
  expiry: '2026-03-17T00:00:00', // optional
});

// payment.url    → redirect customer here
// payment.refNo  → DragonPay reference number
// payment.txnId  → your transaction ID
// payment.status → 'S' (success creating the request)
```

### Check Transaction Status

```typescript
const status = await client.getTransactionStatus('ORDER-001');
// status.status  → 'S' | 'F' | 'P' | 'U' | 'V' | ...
// status.message → human-readable message
```

### Cancel a Transaction

```typescript
const result = await client.cancelTransaction('ORDER-001');
```

### List Available Processors

```typescript
const processors = await client.getAvailableProcessors(1000);
// Returns processors available for the given amount
// [{ procId: 'GCSH', shortName: 'GCash', minAmount: 1, maxAmount: 50000, ... }]
```

## Payout API

Requires `payoutPassword` and `payoutUrl` in configuration. The payout password is a separate credential from your collection password — **contact DragonPay directly to request payout API access**, as it is not available in the sandbox merchant portal.

```typescript
const payout = await client.createPayout('PAYOUT-001', {
  firstName: 'Juan',
  lastName: 'Cruz',
  amount: 500,
  description: 'Withdrawal',
  email: 'juan@example.com',
  procId: 'BOG',           // bank payout
  procDetail: '1234567890', // account number
});

const status = await client.getPayoutStatus('PAYOUT-001');
```

## Postback Verification

DragonPay sends postback callbacks to your server when a transaction status changes. The SDK supports all three verification methods:

| Method | Field | Status |
|---|---|---|
| RSA-SHA256 | `signatures` | Current standard |
| HMAC-SHA256 | `signature` | Sunset March 2026 |
| SHA1 digest | `digest` | Legacy |

### Express / Fastify

```typescript
// POST /webhook/dragonpay
app.post('/webhook/dragonpay', async (req, res) => {
  const result = await client.handlePostback(req.body);
  // or: client.handlePostback(req.query) for GET postbacks

  if (!result.verified) {
    return res.status(400).send('Invalid signature');
  }

  // result.txnId, result.status, result.refNo, result.amount, ...
  // Update your order in the database
  res.send('OK');
});
```

### Payout Postback

```typescript
app.post('/webhook/dragonpay/payout', (req, res) => {
  const result = client.handlePayoutPostback(req.body);

  if (!result.verified) {
    return res.status(400).send('Invalid signature');
  }

  // result.txnId, result.status, result.refNo
  res.send('OK');
});
```

### Return URL (Browser Redirect)

After payment, DragonPay redirects the customer to your return URL. This is **not** authoritative — always rely on the server-to-server postback for the real status.

```typescript
// GET /payment/return?txnid=ORDER-001&refno=REF123&status=S&message=OK
app.get('/payment/return', (req, res) => {
  const result = client.parseReturnParams(req.query);
  // Show a "thank you" or "payment failed" page based on result.status
});
```

## Processor Mapping

Map human-readable names to DragonPay processor codes:

```typescript
import { mapProcessorCode, PROCESSOR_MAP } from 'dragonpay-ph';

mapProcessorCode('gcash');     // 'GCSH'
mapProcessorCode('maya');      // 'PYMY'
mapProcessorCode('bpi');       // 'BPI'
mapProcessorCode('7eleven');   // '7ELE'
mapProcessorCode('GCSH');      // 'GCSH' (pass-through)
```

Supported processors: GCash, Maya, GrabPay, ShopeePay, BPI, BDO, UnionBank, Metrobank, InstaPay, PESONet, 7-Eleven, Bayad, Cebuana, M Lhuillier, ECPay, Credit Card, Bank Transfer.

## Transaction ID Generation

```typescript
import { generateTxnId } from 'dragonpay-ph';

const txnId = generateTxnId(); // 'TXN-m4k8q2-a7b3c9d1'
// or: client.generateTxnId()
```

## Status Codes

```typescript
import { DRAGONPAY_STATUS } from 'dragonpay-ph';

DRAGONPAY_STATUS.SUCCESS;    // 'S'
DRAGONPAY_STATUS.FAILURE;    // 'F'
DRAGONPAY_STATUS.PENDING;    // 'P'
DRAGONPAY_STATUS.UNKNOWN;    // 'U'
DRAGONPAY_STATUS.VOID;       // 'V'
DRAGONPAY_STATUS.QUEUED;     // 'Q'
DRAGONPAY_STATUS.REFUND;     // 'R'
DRAGONPAY_STATUS.CHARGEBACK; // 'K'
```

## Error Handling

```typescript
import { DragonPayError, SignatureVerificationError } from 'dragonpay-ph';

try {
  await client.createPayment('ORDER-001', { ... });
} catch (err) {
  if (err instanceof DragonPayError) {
    console.log(err.code);       // error code from API
    console.log(err.apiMessage); // raw API message
  }
}
```

## Mock Server

For local development without DragonPay credentials:

```typescript
import { createMockServer } from 'dragonpay-ph/mock';

const mock = createMockServer({
  port: 4010,
  merchantId: 'TEST',
  password: 'test',
  postbackUrl: 'http://localhost:3000/webhook/dragonpay',
});

await mock.start();

// Point your client at the mock
const client = new DragonPayClient({
  merchantId: 'TEST',
  password: 'test',
  collectUrl: 'http://localhost:4010/api/collect/v2',
  payoutUrl: 'http://localhost:4010/api/payout/merchant/v1',
  payoutPassword: 'any-token',
});

// Use client as normal — mock handles all API endpoints
// Visit http://localhost:4010 for the dashboard
// Visit http://localhost:4010/pay/{txnId} to simulate payment outcomes
```

The mock server provides:
- All Collection API endpoints (create, status, cancel, processors)
- All Payout API endpoints (create, status)
- A payment page with "Simulate Success/Failure" buttons
- Postback callbacks with valid SHA1 digests
- A dashboard showing all transactions
- Duplicate transaction detection

### Running the Demo

```bash
cd packages/dragonpay-node
npx tsx examples/demo.ts
```

## API Reference

### `DragonPayClient`

| Method | Description |
|---|---|
| `createPayment(txnId, input)` | Create a collection payment request |
| `getTransactionStatus(txnId)` | Get current transaction status |
| `cancelTransaction(txnId)` | Void/cancel a pending transaction |
| `getAvailableProcessors(amount)` | List available payment processors |
| `handlePostback(params)` | Verify and parse a collection postback |
| `handlePayoutPostback(params)` | Verify and parse a payout postback |
| `parseReturnParams(params)` | Parse return URL params (UX only) |
| `createPayout(txnId, input)` | Create a payout/disbursement |
| `getPayoutStatus(txnId)` | Get payout status |
| `getPublicKeys(forceRefresh?)` | Fetch RSA public keys (cached 1hr) |
| `generateTxnId()` | Generate a unique transaction ID |
| `mapProcessorCode(code)` | Map processor name to DragonPay code |

## License

MIT
