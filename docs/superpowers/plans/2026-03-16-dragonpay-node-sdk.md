# DragonPay Node SDK Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade, framework-agnostic TypeScript SDK for DragonPay's Collection and Payout APIs, published as `@anthropic-test/dragonpay` (scoped name TBD by user).

**Architecture:** Monorepo with npm workspaces. Core SDK (`dragonpay-node`) is a plain TypeScript library with zero runtime dependencies — uses only Node built-ins (`crypto`, `buffer`) and native `fetch` (Node 18+). All HTTP calls go through an internal `request()` helper that can be swapped for mock mode. Each API surface (collection, payout, verification) is a separate module composed into a single `DragonPayClient` class.

**Tech Stack:** TypeScript 5.x, Node 18+, Vitest for testing, tsup for bundling (dual CJS/ESM), npm workspaces for monorepo.

---

## File Structure

```
dragonpay-js/                          ← monorepo root (= /Volumes/code/sdk/node-dragonpay)
├── package.json                       ← npm workspaces config, no deps
├── tsconfig.base.json                 ← shared TS settings
├── .gitignore
├── packages/
│   ├── dragonpay-node/                ← core SDK
│   │   ├── package.json               ← name, exports, scripts, devDeps
│   │   ├── tsconfig.json              ← extends base
│   │   ├── vitest.config.ts
│   │   ├── tsup.config.ts                 ← dual CJS/ESM build config
│   │   ├── src/
│   │   │   ├── index.ts               ← public API re-exports
│   │   │   ├── client.ts              ← DragonPayClient class (composes modules)
│   │   │   ├── types.ts               ← all interfaces and type definitions
│   │   │   ├── errors.ts              ← DragonPayError, SignatureVerificationError
│   │   │   ├── auth.ts                ← getCollectHeaders(), getPayoutHeaders()
│   │   │   ├── collection.ts          ← createPayment(), getStatus(), cancel()
│   │   │   ├── payout.ts              ← createPayout(), getPayoutStatus()
│   │   │   ├── verification.ts        ← RSA-SHA256, HMAC-SHA256, SHA1 verify
│   │   │   ├── processors.ts          ← PROCESSOR_MAP + mapProcessorCode()
│   │   │   └── utils.ts               ← generateTxnId(), formatAmount()
│   │   └── tests/
│   │       ├── auth.test.ts
│   │       ├── collection.test.ts
│   │       ├── payout.test.ts
│   │       ├── verification.test.ts
│   │       ├── processors.test.ts
│   │       ├── utils.test.ts
│   │       └── client.test.ts         ← integration-style tests of full client
│   └── nestjs-dragonpay/              ← placeholder (out of scope for this plan)
│       └── package.json
```

**Module responsibilities:**

| File | Responsibility | Dependencies |
|------|---------------|--------------|
| `types.ts` | All interfaces, enums, config types | None |
| `errors.ts` | Typed error classes with status codes | `types.ts` |
| `auth.ts` | Build Authorization headers for both APIs | None (uses `Buffer`) |
| `processors.ts` | Map human-readable names → ProcId codes | None |
| `utils.ts` | Transaction ID generation, amount formatting | None |
| `collection.ts` | Collection API HTTP calls | `types.ts`, `auth.ts`, `errors.ts` |
| `payout.ts` | Payout API HTTP calls | `types.ts`, `auth.ts`, `errors.ts` |
| `verification.ts` | All 3 signature verification schemes + key caching | `types.ts`, `auth.ts`, `errors.ts` (uses `crypto`) |
| `client.ts` | Composes all modules into `DragonPayClient` | Everything above |
| `index.ts` | Public exports | `client.ts`, `types.ts`, `errors.ts`, `processors.ts` |

---

## Chunk 1: Monorepo Scaffold + Types + Pure Utilities

### Task 1: Initialize monorepo and git

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `packages/dragonpay-node/package.json`
- Create: `packages/dragonpay-node/tsconfig.json`
- Create: `packages/dragonpay-node/vitest.config.ts`
- Create: `packages/nestjs-dragonpay/package.json`

- [ ] **Step 1: Create root `package.json` with workspaces**

```json
{
  "name": "dragonpay-js",
  "private": true,
  "workspaces": ["packages/*"]
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
dist/
*.tsbuildinfo
.env
.env.*
coverage/
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 4: Create `packages/dragonpay-node/package.json`**

```json
{
  "name": "@anthropic-test/dragonpay",
  "version": "0.1.0",
  "description": "Production-grade TypeScript SDK for DragonPay Collection and Payout APIs",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 5: Create `packages/dragonpay-node/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create `packages/dragonpay-node/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 7: Create tsup config `packages/dragonpay-node/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

- [ ] **Step 8: Create placeholder `packages/nestjs-dragonpay/package.json`**

```json
{
  "name": "@anthropic-test/nestjs-dragonpay",
  "version": "0.1.0",
  "private": true,
  "description": "NestJS wrapper for @anthropic-test/dragonpay (coming soon)"
}
```

- [ ] **Step 9: Install dependencies**

Run: `cd /Volumes/code/sdk/node-dragonpay && npm install`

- [ ] **Step 10: Initialize git and commit**

```bash
git init
git add -A
git commit -m "chore: scaffold monorepo with npm workspaces"
```

---

### Task 2: Types

**Files:**
- Create: `packages/dragonpay-node/src/types.ts`

- [ ] **Step 1: Write all type definitions**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/dragonpay-node/src/types.ts
git commit -m "feat: add all TypeScript type definitions"
```

---

### Task 3: Error classes

**Files:**
- Create: `packages/dragonpay-node/src/errors.ts`
- Create: `packages/dragonpay-node/tests/errors.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from 'vitest';
import { DragonPayError, SignatureVerificationError } from '../src/errors';

describe('DragonPayError', () => {
  it('includes status code and message', () => {
    const err = new DragonPayError('Payment failed', -1, 'Invalid amount');
    expect(err.message).toBe('Payment failed');
    expect(err.code).toBe(-1);
    expect(err.apiMessage).toBe('Invalid amount');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('SignatureVerificationError', () => {
  it('extends DragonPayError', () => {
    const err = new SignatureVerificationError('Bad signature');
    expect(err.message).toBe('Bad signature');
    expect(err).toBeInstanceOf(DragonPayError);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/dragonpay-node && npx vitest run tests/errors.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
export class DragonPayError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly apiMessage?: string,
  ) {
    super(message);
    this.name = 'DragonPayError';
  }
}

export class SignatureVerificationError extends DragonPayError {
  constructor(message: string) {
    super(message);
    this.name = 'SignatureVerificationError';
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd packages/dragonpay-node && npx vitest run tests/errors.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dragonpay-node/src/errors.ts packages/dragonpay-node/tests/errors.test.ts
git commit -m "feat: add error classes"
```

---

### Task 4: Auth helpers

**Files:**
- Create: `packages/dragonpay-node/src/auth.ts`
- Create: `packages/dragonpay-node/tests/auth.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest';
import { getCollectHeaders, getPayoutHeaders } from '../src/auth';

describe('getCollectHeaders', () => {
  it('returns Basic auth with base64-encoded merchantId:password', () => {
    const headers = getCollectHeaders('MERCHANT1', 'secret123');
    const expected = Buffer.from('MERCHANT1:secret123', 'utf-8').toString('base64');
    expect(headers.Authorization).toBe(`Basic ${expected}`);
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('getPayoutHeaders', () => {
  it('returns Bearer auth with payout password', () => {
    const headers = getPayoutHeaders('payoutSecret');
    expect(headers.Authorization).toBe('Bearer payoutSecret');
    expect(headers['Content-Type']).toBe('application/json');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/dragonpay-node && npx vitest run tests/auth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
export function getCollectHeaders(merchantId: string, password: string): Record<string, string> {
  const credentials = Buffer.from(`${merchantId}:${password}`, 'utf-8').toString('base64');
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${credentials}`,
  };
}

export function getPayoutHeaders(payoutPassword: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${payoutPassword}`,
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd packages/dragonpay-node && npx vitest run tests/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dragonpay-node/src/auth.ts packages/dragonpay-node/tests/auth.test.ts
git commit -m "feat: add auth header helpers"
```

---

### Task 5: Processor map

**Files:**
- Create: `packages/dragonpay-node/src/processors.ts`
- Create: `packages/dragonpay-node/tests/processors.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest';
import { mapProcessorCode, PROCESSOR_MAP } from '../src/processors';

describe('mapProcessorCode', () => {
  it('maps gcash to GCSH', () => {
    expect(mapProcessorCode('gcash')).toBe('GCSH');
  });

  it('maps maya to PYMY', () => {
    expect(mapProcessorCode('maya')).toBe('PYMY');
  });

  it('maps paymaya to PYMY (alias)', () => {
    expect(mapProcessorCode('paymaya')).toBe('PYMY');
  });

  it('maps 7eleven to 7ELE', () => {
    expect(mapProcessorCode('7eleven')).toBe('7ELE');
  });

  it('is case-insensitive', () => {
    expect(mapProcessorCode('GCash')).toBe('GCSH');
    expect(mapProcessorCode('BPI')).toBe('BPI');
  });

  it('returns undefined for unknown processor', () => {
    expect(mapProcessorCode('venmo')).toBeUndefined();
  });

  it('passes through valid ProcId codes unchanged', () => {
    expect(mapProcessorCode('GCSH')).toBe('GCSH');
  });
});

describe('PROCESSOR_MAP', () => {
  it('contains all expected processors', () => {
    expect(Object.keys(PROCESSOR_MAP).length).toBeGreaterThanOrEqual(20);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/dragonpay-node && npx vitest run tests/processors.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
export const PROCESSOR_MAP: Record<string, string> = {
  gcash: 'GCSH',
  maya: 'PYMY',
  paymaya: 'PYMY',
  grabpay: 'GRAB',
  shopeepay: 'SHPE',
  bpi: 'BPI',
  bdo: 'BDO',
  unionbank: 'UBP',
  metrobank: 'MBTC',
  instapay: 'INST',
  pesonet: 'PESO',
  '7eleven': '7ELE',
  bayad: 'BAYD',
  cebuana: 'CEBL',
  mlhuillier: 'MLH',
  ecpay: 'ECPY',
  credit_card: 'CC',
  bank_account: 'BOG',
  bog: 'BOG',
  bogx: 'BOGX',
  // ProcId codes map to themselves for pass-through
  gcsh: 'GCSH',
  pymy: 'PYMY',
  grab: 'GRAB',
  shpe: 'SHPE',
  ubp: 'UBP',
  mbtc: 'MBTC',
  inst: 'INST',
  peso: 'PESO',
  '7ele': '7ELE',
  bayd: 'BAYD',
  cebl: 'CEBL',
  mlh: 'MLH',
  ecpy: 'ECPY',
  cc: 'CC',
};

export function mapProcessorCode(code: string): string | undefined {
  return PROCESSOR_MAP[code.toLowerCase()];
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd packages/dragonpay-node && npx vitest run tests/processors.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dragonpay-node/src/processors.ts packages/dragonpay-node/tests/processors.test.ts
git commit -m "feat: add processor ID map"
```

---

### Task 6: Utility functions

**Files:**
- Create: `packages/dragonpay-node/src/utils.ts`
- Create: `packages/dragonpay-node/tests/utils.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest';
import { generateTxnId, formatAmount } from '../src/utils';

describe('generateTxnId', () => {
  it('starts with TXN- prefix', () => {
    expect(generateTxnId()).toMatch(/^TXN-/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTxnId()));
    expect(ids.size).toBe(100);
  });

  it('contains only alphanumeric characters and hyphens', () => {
    const id = generateTxnId();
    expect(id).toMatch(/^[A-Z0-9-]+$/);
  });
});

describe('formatAmount', () => {
  it('formats integer to 2 decimal places', () => {
    expect(formatAmount(100)).toBe('100.00');
  });

  it('formats float to 2 decimal places', () => {
    expect(formatAmount(99.9)).toBe('99.90');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatAmount(10.999)).toBe('11.00');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/dragonpay-node && npx vitest run tests/utils.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
export function generateTxnId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${timestamp}-${random}`;
}

export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd packages/dragonpay-node && npx vitest run tests/utils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dragonpay-node/src/utils.ts packages/dragonpay-node/tests/utils.test.ts
git commit -m "feat: add utility functions"
```

---

## Chunk 2: Collection API

### Task 7: Collection — createPayment

**Files:**
- Create: `packages/dragonpay-node/src/collection.ts`
- Create: `packages/dragonpay-node/tests/collection.test.ts`

- [ ] **Step 1: Write tests for createPayment**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPayment } from '../src/collection';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('createPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends POST to {baseUrl}/{txnid}/post with PascalCase body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ RefNo: 'REF123', Status: 'S', Message: 'OK', Url: 'https://pay.dragonpay.ph/xyz' }),
    });

    const result = await createPayment(
      'TXN-001',
      {
        amount: 100,
        description: 'Test payment',
        email: 'test@example.com',
        procId: 'GCSH',
      },
      'MERCHANT1',
      'secret123',
      'https://gw.dragonpay.ph/api/collect/v2',
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gw.dragonpay.ph/api/collect/v2/TXN-001/post');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.Amount).toBe('100.00');
    expect(body.Description).toBe('Test payment');
    expect(body.Email).toBe('test@example.com');
    expect(body.ProcId).toBe('GCSH');
    expect(body.Currency).toBe('PHP');

    expect(result.txnId).toBe('TXN-001');
    expect(result.refNo).toBe('REF123');
    expect(result.url).toBe('https://pay.dragonpay.ph/xyz');
  });

  it('includes billing details with PascalCase keys', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ RefNo: 'REF456', Status: 'S', Message: 'OK', Url: 'https://pay.dragonpay.ph/abc' }),
    });

    await createPayment(
      'TXN-002',
      {
        amount: 250.50,
        description: 'With billing',
        email: 'test@example.com',
        billingDetails: {
          firstName: 'Juan',
          lastName: 'Cruz',
          state: 'Metro Manila',
        },
      },
      'MERCHANT1',
      'secret123',
      'https://gw.dragonpay.ph/api/collect/v2',
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.BillingDetails.FirstName).toBe('Juan');
    expect(body.BillingDetails.LastName).toBe('Cruz');
    expect(body.BillingDetails.Province).toBe('Metro Manila');
  });

  it('throws DragonPayError on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ Status: -1, Message: 'Unauthorized' }),
    });

    await expect(
      createPayment('TXN-003', { amount: 100, description: 'Fail', email: 'x@y.com' }, 'BAD', 'BAD', 'https://gw.dragonpay.ph/api/collect/v2'),
    ).rejects.toThrow('Unauthorized');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/dragonpay-node && npx vitest run tests/collection.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement createPayment**

```ts
import type { CreatePaymentInput, PaymentResult, TransactionStatus } from './types';
import { getCollectHeaders } from './auth';
import { DragonPayError } from './errors';
import { formatAmount } from './utils';

export async function createPayment(
  txnId: string,
  input: CreatePaymentInput,
  merchantId: string,
  password: string,
  baseUrl: string,
): Promise<PaymentResult> {
  const url = `${baseUrl}/${txnId}/post`;

  const payload: Record<string, unknown> = {
    Amount: formatAmount(input.amount),
    Currency: input.currency || 'PHP',
    Description: input.description,
    Email: input.email,
  };

  if (input.procId) payload.ProcId = input.procId;
  if (input.param1) payload.Param1 = input.param1;
  if (input.param2) payload.Param2 = input.param2;
  if (input.expiry) payload.Expiry = input.expiry;
  if (input.ipAddress) payload.IpAddress = input.ipAddress;
  if (input.userAgent) payload.UserAgent = input.userAgent;

  if (input.billingDetails) {
    const bd = input.billingDetails;
    payload.BillingDetails = {
      ...(bd.firstName && { FirstName: bd.firstName }),
      ...(bd.lastName && { LastName: bd.lastName }),
      ...(bd.address1 && { Address1: bd.address1 }),
      ...(bd.city && { City: bd.city }),
      ...(bd.state && { Province: bd.state }),
      ...(bd.country && { Country: bd.country }),
      ...(bd.zipCode && { ZipCode: bd.zipCode }),
      ...(bd.telNo && { TelNo: bd.telNo }),
      ...(bd.email && { Email: bd.email }),
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: getCollectHeaders(merchantId, password),
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new DragonPayError(data.Message || `HTTP ${response.status}`, data.Status, data.Message);
  }

  return {
    txnId,
    refNo: data.RefNo,
    status: data.Status,
    message: data.Message,
    url: data.Url,
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd packages/dragonpay-node && npx vitest run tests/collection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dragonpay-node/src/collection.ts packages/dragonpay-node/tests/collection.test.ts
git commit -m "feat: add createPayment for collection API"
```

---

### Task 8: Collection — getTransactionStatus and cancelTransaction

**Files:**
- Modify: `packages/dragonpay-node/src/collection.ts`
- Modify: `packages/dragonpay-node/tests/collection.test.ts`

- [ ] **Step 1: Write tests for getTransactionStatus**

Append to `tests/collection.test.ts` (and update the import at the top to include the new functions):

```ts
// Update import to:
// import { createPayment, getTransactionStatus, cancelTransaction } from '../src/collection';

describe('getTransactionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends GET to {baseUrl}/{txnid}', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ RefNo: 'REF100', Status: 'S', Message: 'Completed' }),
    });

    const result = await getTransactionStatus('TXN-100', 'MERCHANT1', 'secret', 'https://gw.dragonpay.ph/api/collect/v2');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gw.dragonpay.ph/api/collect/v2/TXN-100');
    expect(options.method).toBe('GET');
    expect(result.status).toBe('S');
  });
});

describe('cancelTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends GET to {baseUrl}/{txnid}/void', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Status: 0, Message: 'Voided' }),
    });

    const result = await cancelTransaction('TXN-100', 'MERCHANT1', 'secret', 'https://gw.dragonpay.ph/api/collect/v2');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gw.dragonpay.ph/api/collect/v2/TXN-100/void');
    expect(options.method).toBe('GET');
    expect(result.message).toBe('Voided');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/dragonpay-node && npx vitest run tests/collection.test.ts`
Expected: FAIL — getTransactionStatus, cancelTransaction not exported

- [ ] **Step 3: Implement getTransactionStatus and cancelTransaction**

Append to `src/collection.ts`:

```ts
export async function getTransactionStatus(
  txnId: string,
  merchantId: string,
  password: string,
  baseUrl: string,
): Promise<TransactionStatus> {
  const response = await fetch(`${baseUrl}/${txnId}`, {
    method: 'GET',
    headers: getCollectHeaders(merchantId, password),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new DragonPayError(data.Message || `HTTP ${response.status}`, data.Status, data.Message);
  }

  return {
    txnId,
    refNo: data.RefNo,
    status: data.Status,
    message: data.Message,
  };
}

export async function cancelTransaction(
  txnId: string,
  merchantId: string,
  password: string,
  baseUrl: string,
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${baseUrl}/${txnId}/void`, {
    method: 'GET',
    headers: getCollectHeaders(merchantId, password),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new DragonPayError(data.Message || `HTTP ${response.status}`, data.Status, data.Message);
  }

  return { status: data.Status, message: data.Message };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd packages/dragonpay-node && npx vitest run tests/collection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dragonpay-node/src/collection.ts packages/dragonpay-node/tests/collection.test.ts
git commit -m "feat: add getTransactionStatus and cancelTransaction"
```

---

### Task 9: Collection — getAvailableProcessors

**Files:**
- Modify: `packages/dragonpay-node/src/collection.ts`
- Modify: `packages/dragonpay-node/tests/collection.test.ts`

- [ ] **Step 1: Write test**

Append to `tests/collection.test.ts` (and update the import at the top to include `getAvailableProcessors`):

```ts
// Update import to:
// import { createPayment, getTransactionStatus, cancelTransaction, getAvailableProcessors } from '../src/collection';

describe('getAvailableProcessors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends GET to {baseUrl}/processors with amount filter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { procId: 'GCSH', shortName: 'GCash', longName: 'GCash', logo: '', currencies: ['PHP'], minAmount: 1, maxAmount: 50000 },
      ]),
    });

    const result = await getAvailableProcessors(100, 'MERCHANT1', 'secret', 'https://gw.dragonpay.ph/api/collect/v2');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gw.dragonpay.ph/api/collect/v2/processors/100.00');
    expect(result).toHaveLength(1);
    expect(result[0].procId).toBe('GCSH');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/dragonpay-node && npx vitest run tests/collection.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

Append to `src/collection.ts`:

```ts
import type { Processor } from './types';

export async function getAvailableProcessors(
  amount: number,
  merchantId: string,
  password: string,
  baseUrl: string,
): Promise<Processor[]> {
  const response = await fetch(`${baseUrl}/processors/${formatAmount(amount)}`, {
    method: 'GET',
    headers: getCollectHeaders(merchantId, password),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new DragonPayError(data.Message || `HTTP ${response.status}`, data.Status, data.Message);
  }

  // Map PascalCase API response to camelCase Processor type
  return data.map((p: Record<string, unknown>) => ({
    procId: p.ProcId,
    shortName: p.ShortName,
    longName: p.LongName,
    logo: p.Logo,
    currencies: p.Currencies,
    minAmount: p.MinAmount,
    maxAmount: p.MaxAmount,
  }));
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd packages/dragonpay-node && npx vitest run tests/collection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dragonpay-node/src/collection.ts packages/dragonpay-node/tests/collection.test.ts
git commit -m "feat: add getAvailableProcessors"
```

---

## Chunk 3: Signature Verification

### Task 10: SHA1 digest verification (legacy + payout)

**Files:**
- Create: `packages/dragonpay-node/src/verification.ts`
- Create: `packages/dragonpay-node/tests/verification.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { verifySha1Digest, verifyPayoutDigest } from '../src/verification';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('verifySha1Digest', () => {
  it('verifies valid SHA1 digest for collection postback', () => {
    // SHA1(txnid:refno:status:message:password)
    const message = 'TXN-001:REF123:S:Success:secret123';
    const digest = crypto.createHash('sha1').update(message).digest('hex');

    const result = verifySha1Digest(
      { txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'Success', digest },
      'secret123',
    );
    expect(result).toBe(true);
  });

  it('returns false for invalid digest', () => {
    const result = verifySha1Digest(
      { txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'Success', digest: 'wrong' },
      'secret123',
    );
    expect(result).toBe(false);
  });

  it('returns false if digest is missing', () => {
    const result = verifySha1Digest(
      { txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'Success' },
      'secret123',
    );
    expect(result).toBe(false);
  });
});

describe('verifyPayoutDigest', () => {
  it('verifies valid payout SHA1 digest', () => {
    const message = 'TXN-001:REF123:S:Success:secret123';
    const digest = crypto.createHash('sha1').update(message).digest('hex');

    const result = verifyPayoutDigest(
      { merchantTxnId: 'TXN-001', refNo: 'REF123', status: 'S', message: 'Success', digest },
      'secret123',
    );
    expect(result).toBe(true);
  });

  it('is case-insensitive for hex comparison', () => {
    const message = 'TXN-001:REF123:S:Success:secret123';
    const digest = crypto.createHash('sha1').update(message).digest('hex').toUpperCase();

    const result = verifyPayoutDigest(
      { merchantTxnId: 'TXN-001', refNo: 'REF123', status: 'S', message: 'Success', digest },
      'secret123',
    );
    expect(result).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/dragonpay-node && npx vitest run tests/verification.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
import * as crypto from 'crypto';
import type { PostbackParams, PayoutPostbackParams, DragonPayPublicKey } from './types';
import { getCollectHeaders } from './auth';

export function verifySha1Digest(
  callback: Pick<PostbackParams, 'txnid' | 'refno' | 'status' | 'message' | 'digest'>,
  password: string,
): boolean {
  if (!callback.digest) return false;
  const message = `${callback.txnid}:${callback.refno}:${callback.status}:${callback.message}:${password}`;
  const expected = crypto.createHash('sha1').update(message).digest('hex').toLowerCase();
  return expected === callback.digest.toLowerCase();
}

export function verifyPayoutDigest(
  callback: Pick<PayoutPostbackParams, 'merchantTxnId' | 'refNo' | 'status' | 'message' | 'digest'>,
  collectionPassword: string,
): boolean {
  if (!callback.digest) return false;
  const message = `${callback.merchantTxnId}:${callback.refNo}:${callback.status}:${callback.message}:${collectionPassword}`;
  const expected = crypto.createHash('sha1').update(message).digest('hex').toLowerCase();
  return expected === callback.digest.toLowerCase();
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd packages/dragonpay-node && npx vitest run tests/verification.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dragonpay-node/src/verification.ts packages/dragonpay-node/tests/verification.test.ts
git commit -m "feat: add SHA1 digest verification for collection and payout"
```

---

### Task 11: HMAC-SHA256 signature verification

**Files:**
- Modify: `packages/dragonpay-node/src/verification.ts`
- Modify: `packages/dragonpay-node/tests/verification.test.ts`

- [ ] **Step 1: Write tests**

Append to `tests/verification.test.ts`:

```ts
import { verifyHmacSha256 } from '../src/verification';

describe('verifyHmacSha256', () => {
  it('verifies valid HMAC-SHA256 signature', () => {
    const message = 'TXN-001:REF123:S:Success:MERCHANT1::';
    const hmac = crypto.createHmac('sha256', 'secret123').update(message).digest('base64');

    const result = verifyHmacSha256(
      {
        txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'Success',
        merchantid: 'MERCHANT1', param1: '', param2: '', signature: hmac,
      },
      'secret123',
    );
    expect(result).toBe(true);
  });

  it('returns false for invalid signature', () => {
    const result = verifyHmacSha256(
      {
        txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'Success',
        merchantid: 'MERCHANT1', param1: '', param2: '', signature: 'wrong',
      },
      'secret123',
    );
    expect(result).toBe(false);
  });

  it('returns false if signature is missing', () => {
    const result = verifyHmacSha256(
      { txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'Success' },
      'secret123',
    );
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/dragonpay-node && npx vitest run tests/verification.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

Append to `src/verification.ts`:

```ts
export function verifyHmacSha256(
  callback: Pick<PostbackParams, 'txnid' | 'refno' | 'status' | 'message' | 'merchantid' | 'param1' | 'param2' | 'signature'>,
  password: string,
): boolean {
  if (!callback.signature) return false;
  const message = [
    callback.txnid, callback.refno, callback.status, callback.message,
    callback.merchantid || '', callback.param1 || '', callback.param2 || '',
  ].join(':');
  const expected = crypto.createHmac('sha256', password).update(message).digest('base64');
  return expected === callback.signature;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd packages/dragonpay-node && npx vitest run tests/verification.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dragonpay-node/src/verification.ts packages/dragonpay-node/tests/verification.test.ts
git commit -m "feat: add HMAC-SHA256 signature verification"
```

---

### Task 12: RSA-SHA256 signature verification + key fetching

**Files:**
- Modify: `packages/dragonpay-node/src/verification.ts`
- Modify: `packages/dragonpay-node/tests/verification.test.ts`

- [ ] **Step 1: Write tests**

Append to `tests/verification.test.ts`:

```ts
import { buildSignatureMessage, verifyRsaSha256, derToPublicKeyPem, fetchPublicKeys } from '../src/verification';

describe('buildSignatureMessage', () => {
  it('joins 8 fields with colons', () => {
    const msg = buildSignatureMessage({
      txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'OK',
      merchantid: 'MERCHANT1', param1: 'p1', param2: 'p2', amount: '100',
    });
    expect(msg).toBe('TXN-001:REF123:S:OK:MERCHANT1:p1:p2:100.00');
  });

  it('formats amount to 2 decimal places', () => {
    const msg = buildSignatureMessage({
      txnid: 'T', refno: 'R', status: 'S', message: 'M',
      amount: '99.9',
    });
    expect(msg).toBe('T:R:S:M:::99.90');
  });

  it('defaults missing fields to empty strings', () => {
    const msg = buildSignatureMessage({ txnid: 'T', refno: 'R', status: 'S', message: 'M' });
    expect(msg).toBe('T:R:S:M:::0.00');
  });
});

describe('derToPublicKeyPem', () => {
  it('wraps base64 DER in PEM headers with 64-char lines', () => {
    const shortDer = Buffer.from('test-key-data').toString('base64');
    const pem = derToPublicKeyPem(shortDer);
    expect(pem).toMatch(/^-----BEGIN PUBLIC KEY-----\n/);
    expect(pem).toMatch(/\n-----END PUBLIC KEY-----$/);
  });
});

describe('verifyRsaSha256', () => {
  // Generate a test RSA key pair for verification tests
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const publicKeyBase64 = (publicKey as Buffer).toString('base64');

  it('verifies a valid RSA-SHA256 signature', () => {
    const message = 'TXN-001:REF123:S:OK:MERCHANT1::100.00';
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(Buffer.from(message, 'utf-8'));
    const signature = signer.sign(privateKey as string, 'base64');

    const keys: DragonPayPublicKey[] = [{ value: publicKeyBase64, status: 'Active' }];

    const result = verifyRsaSha256(
      {
        txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'OK',
        merchantid: 'MERCHANT1', param1: '', param2: '', amount: '100',
        signatures: signature,
      },
      keys,
    );
    expect(result).toBe(true);
  });

  it('returns false for invalid signature', () => {
    const keys: DragonPayPublicKey[] = [{ value: publicKeyBase64, status: 'Active' }];

    const result = verifyRsaSha256(
      {
        txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'OK',
        merchantid: 'MERCHANT1', amount: '100', signatures: 'invalidsig==',
      },
      keys,
    );
    expect(result).toBe(false);
  });

  it('skips revoked keys', () => {
    const message = 'TXN-001:REF123:S:OK:MERCHANT1::100.00';
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(Buffer.from(message, 'utf-8'));
    const signature = signer.sign(privateKey as string, 'base64');

    const keys: DragonPayPublicKey[] = [{ value: publicKeyBase64, status: 'Revoked' }];

    const result = verifyRsaSha256(
      {
        txnid: 'TXN-001', refno: 'REF123', status: 'S', message: 'OK',
        merchantid: 'MERCHANT1', amount: '100', signatures: signature,
      },
      keys,
    );
    expect(result).toBe(false);
  });

  it('returns false if signatures field is missing', () => {
    const keys: DragonPayPublicKey[] = [{ value: publicKeyBase64, status: 'Active' }];
    const result = verifyRsaSha256(
      { txnid: 'T', refno: 'R', status: 'S', message: 'M' },
      keys,
    );
    expect(result).toBe(false);
  });
});

describe('fetchPublicKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches keys from /v1/keys/callback endpoint', async () => {
    const mockKeys = [{ value: 'abc123', status: 'Active' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockKeys,
    });

    const keys = await fetchPublicKeys('https://gw.dragonpay.ph/api/collect/v2', 'MERCHANT1', 'secret');

    const [url] = mockFetch.mock.calls[0];
    // Keys endpoint uses /v1 even when collect base is /v2
    expect(url).toBe('https://gw.dragonpay.ph/api/collect/v1/keys/callback');
    expect(keys).toEqual(mockKeys);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/dragonpay-node && npx vitest run tests/verification.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

Add to `src/verification.ts`:

```ts
export function buildSignatureMessage(callback: {
  txnid: string;
  refno: string;
  status: string;
  message: string;
  merchantid?: string;
  param1?: string;
  param2?: string;
  amount?: string;
}): string {
  const amountFormatted = parseFloat(callback.amount || '0').toFixed(2);
  return [
    callback.txnid, callback.refno, callback.status, callback.message,
    callback.merchantid || '', callback.param1 || '', callback.param2 || '',
    amountFormatted,
  ].join(':');
}

export function derToPublicKeyPem(base64Der: string): string {
  const derBuffer = Buffer.from(base64Der, 'base64');
  const pemBody = derBuffer.toString('base64').match(/.{1,64}/g)!.join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${pemBody}\n-----END PUBLIC KEY-----`;
}

export function verifyRsaSha256(
  callback: Pick<PostbackParams, 'txnid' | 'refno' | 'status' | 'message' | 'merchantid' | 'param1' | 'param2' | 'amount' | 'signatures'>,
  keys: DragonPayPublicKey[],
): boolean {
  if (!callback.signatures) return false;

  const message = buildSignatureMessage(callback);
  const signatureBuffer = Buffer.from(callback.signatures, 'base64');
  const messageBytes = Buffer.from(message, 'utf-8');

  return keys
    .filter((k) => k.status === 'Active')
    .some((key) => {
      try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(messageBytes);
        return verifier.verify(derToPublicKeyPem(key.value), signatureBuffer);
      } catch {
        return false;
      }
    });
}

export async function fetchPublicKeys(
  collectBaseUrl: string,
  merchantId: string,
  password: string,
): Promise<DragonPayPublicKey[]> {
  const keysBaseUrl = collectBaseUrl.replace(/\/v2$/, '/v1');
  const response = await fetch(`${keysBaseUrl}/keys/callback`, {
    headers: getCollectHeaders(merchantId, password),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch public keys: HTTP ${response.status}`);
  }

  return response.json();
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd packages/dragonpay-node && npx vitest run tests/verification.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dragonpay-node/src/verification.ts packages/dragonpay-node/tests/verification.test.ts
git commit -m "feat: add RSA-SHA256 verification with key fetching"
```

---

## Chunk 4: Payout API

### Task 13: Payout — createPayout and getPayoutStatus

**Files:**
- Create: `packages/dragonpay-node/src/payout.ts`
- Create: `packages/dragonpay-node/tests/payout.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPayout, getPayoutStatus } from '../src/payout';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('createPayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends POST to {payoutUrl}/{merchantId}/post with Bearer auth', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Code: 0, Message: 'PAYOUT-REF-001' }),
    });

    const result = await createPayout(
      'TXN-P-001',
      {
        firstName: 'Juan',
        lastName: 'Cruz',
        amount: 500,
        description: 'Payout test',
        email: 'juan@example.com',
        procId: 'BOG',
        procDetail: '1234567890',
      },
      'MERCHANT1',
      'payoutSecret',
      'https://gw.dragonpay.ph/api/payout/merchant/v1',
    );

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gw.dragonpay.ph/api/payout/merchant/v1/MERCHANT1/post');
    expect(options.headers.Authorization).toBe('Bearer payoutSecret');

    const body = JSON.parse(options.body);
    expect(body.TxnId).toBe('TXN-P-001');
    expect(body.FirstName).toBe('Juan');
    expect(body.Amount).toBe('500.00');
    expect(body.ProcId).toBe('BOG');
    expect(body.ProcDetail).toBe('1234567890');

    // Code 0 = queued; Message IS the reference number
    expect(result.refNo).toBe('PAYOUT-REF-001');
    expect(result.status).toBe('Q');
  });

  it('throws on non-zero Code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Code: -1, Message: 'Invalid account' }),
    });

    await expect(
      createPayout(
        'TXN-P-002',
        { firstName: 'A', lastName: 'B', amount: 100, description: 'Fail', email: 'x@y.com', procId: 'BOG', procDetail: '999' },
        'MERCHANT1', 'payoutSecret', 'https://gw.dragonpay.ph/api/payout/merchant/v1',
      ),
    ).rejects.toThrow('Invalid account');
  });
});

describe('getPayoutStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends GET to {payoutUrl}/{merchantId}/{txnId}', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ RefNo: 'PREF-1', Status: 'S', Message: 'Completed' }),
    });

    const result = await getPayoutStatus(
      'TXN-P-001', 'MERCHANT1', 'payoutSecret', 'https://gw.dragonpay.ph/api/payout/merchant/v1',
    );

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://gw.dragonpay.ph/api/payout/merchant/v1/MERCHANT1/TXN-P-001');
    expect(result.status).toBe('S');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/dragonpay-node && npx vitest run tests/payout.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
import type { CreatePayoutInput, PayoutResult, PayoutStatus } from './types';
import { getPayoutHeaders } from './auth';
import { DragonPayError } from './errors';
import { formatAmount } from './utils';

export async function createPayout(
  txnId: string,
  input: CreatePayoutInput,
  merchantId: string,
  payoutPassword: string,
  payoutUrl: string,
): Promise<PayoutResult> {
  const url = `${payoutUrl}/${merchantId}/post`;

  const payload = {
    TxnId: txnId,
    FirstName: input.firstName,
    LastName: input.lastName,
    Amount: formatAmount(input.amount),
    Currency: input.currency || 'PHP',
    Description: input.description,
    ProcId: input.procId,
    ProcDetail: input.procDetail,
    RunDate: input.runDate || new Date().toISOString().slice(0, 10),
    Email: input.email,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: getPayoutHeaders(payoutPassword),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new DragonPayError(errorData.Message || `HTTP ${response.status}`, response.status, errorData.Message);
  }

  const data = await response.json();

  // Code 0 = queued. Message field IS the reference number.
  if (data.Code !== 0) {
    throw new DragonPayError(data.Message || `Payout failed with code ${data.Code}`, data.Code, data.Message);
  }

  return {
    txnId,
    refNo: data.Message,
    status: 'Q',
    message: `Payout submitted: ${data.Message}`,
  };
}

export async function getPayoutStatus(
  txnId: string,
  merchantId: string,
  payoutPassword: string,
  payoutUrl: string,
): Promise<PayoutStatus> {
  const response = await fetch(`${payoutUrl}/${merchantId}/${txnId}`, {
    method: 'GET',
    headers: getPayoutHeaders(payoutPassword),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new DragonPayError(data.Message || `HTTP ${response.status}`, data.Status, data.Message);
  }

  return {
    txnId,
    refNo: data.RefNo,
    status: data.Status,
    message: data.Message,
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd packages/dragonpay-node && npx vitest run tests/payout.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dragonpay-node/src/payout.ts packages/dragonpay-node/tests/payout.test.ts
git commit -m "feat: add payout API (createPayout and getPayoutStatus)"
```

---

## Chunk 5: DragonPayClient + Public API

### Task 14: DragonPayClient class

**Files:**
- Create: `packages/dragonpay-node/src/client.ts`
- Create: `packages/dragonpay-node/tests/client.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DragonPayClient } from '../src/client';
import type { DragonPayPublicKey } from '../src/types';
import * as crypto from 'crypto';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('DragonPayClient', () => {
  let client: DragonPayClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
    });
  });

  it('initializes with default production URLs', () => {
    expect(client).toBeDefined();
  });

  it('creates a payment', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ RefNo: 'REF1', Status: 'S', Message: 'OK', Url: 'https://pay.dragonpay.ph/x' }),
    });

    const result = await client.createPayment('TXN-1', {
      amount: 100, description: 'Test', email: 'test@test.com',
    });

    expect(result.txnId).toBe('TXN-1');
    expect(result.refNo).toBe('REF1');
  });

  it('gets transaction status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ RefNo: 'REF1', Status: 'S', Message: 'OK' }),
    });

    const result = await client.getTransactionStatus('TXN-1');
    expect(result.status).toBe('S');
  });

  it('cancels a transaction', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Status: 0, Message: 'Voided' }),
    });

    const result = await client.cancelTransaction('TXN-1');
    expect(result.message).toBe('Voided');
  });

  it('verifies postback with RSA-SHA256 (signatures field)', async () => {
    // Generate test key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const message = 'TXN-1:REF1:S:OK:MERCHANT1::100.00';
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(Buffer.from(message, 'utf-8'));
    const signature = signer.sign(privateKey, 'base64');

    // Mock key fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ value: (publicKey as Buffer).toString('base64'), status: 'Active' }],
    });

    const result = await client.verifyPostback({
      txnid: 'TXN-1', refno: 'REF1', status: 'S', message: 'OK',
      merchantid: 'MERCHANT1', param1: '', param2: '', amount: '100',
      signatures: signature,
    });

    expect(result.verified).toBe(true);
    expect(result.txnId).toBe('TXN-1');
    expect(result.status).toBe('S');
  });

  it('skips verification when skipVerification is true', async () => {
    const skipClient = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
      skipVerification: true,
    });

    const result = await skipClient.verifyPostback({
      txnid: 'TXN-1', refno: 'REF1', status: 'S', message: 'OK',
    });

    expect(result.verified).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('generates unique transaction IDs', () => {
    const id1 = client.generateTxnId();
    const id2 = client.generateTxnId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^TXN-/);
  });

  it('maps processor codes', () => {
    expect(client.mapProcessorCode('gcash')).toBe('GCSH');
    expect(client.mapProcessorCode('unknown')).toBeUndefined();
  });
});

describe('DragonPayClient — payout', () => {
  it('throws if payout is called without payout credentials', async () => {
    const client = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
      // no payoutPassword or payoutUrl
    });

    await expect(
      client.createPayout({
        firstName: 'Juan', lastName: 'Cruz', amount: 100,
        description: 'Test', email: 'x@y.com', procId: 'BOG', procDetail: '123',
      }),
    ).rejects.toThrow('Payout credentials not configured');
  });

  it('creates a payout when credentials are provided', async () => {
    const client = new DragonPayClient({
      merchantId: 'MERCHANT1',
      password: 'secret123',
      payoutPassword: 'payoutSecret',
      payoutUrl: 'https://gw.dragonpay.ph/api/payout/merchant/v1',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Code: 0, Message: 'PREF-1' }),
    });

    const result = await client.createPayout({
      firstName: 'Juan', lastName: 'Cruz', amount: 500,
      description: 'Payout', email: 'j@x.com', procId: 'BOG', procDetail: '123',
    });

    expect(result.refNo).toBe('PREF-1');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/dragonpay-node && npx vitest run tests/client.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement DragonPayClient**

```ts
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

  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    if (!this.payoutPassword || !this.payoutUrl) {
      throw new DragonPayError('Payout credentials not configured');
    }
    const txnId = genTxnId();
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
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd packages/dragonpay-node && npx vitest run tests/client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dragonpay-node/src/client.ts packages/dragonpay-node/tests/client.test.ts
git commit -m "feat: add DragonPayClient composing all API modules"
```

---

### Task 15: Public API exports (index.ts)

**Files:**
- Create: `packages/dragonpay-node/src/index.ts`

- [ ] **Step 1: Create index.ts**

```ts
// Core client
export { DragonPayClient } from './client';

// Types
export type {
  DragonPayConfig,
  CreatePaymentInput,
  BillingDetails,
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

export {
  DRAGONPAY_STATUS,
  COLLECT_URL_PRODUCTION,
  COLLECT_URL_SANDBOX,
  PAYOUT_URL_PRODUCTION,
  PAYOUT_URL_SANDBOX,
} from './types';

// Errors
export { DragonPayError, SignatureVerificationError } from './errors';

// Processor map (for users who want direct access)
export { PROCESSOR_MAP, mapProcessorCode } from './processors';

// Utilities
export { generateTxnId } from './utils';
```

- [ ] **Step 2: Verify build works**

Run: `cd packages/dragonpay-node && npx tsup`
Expected: Build succeeds, outputs `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`

- [ ] **Step 3: Run all tests**

Run: `cd packages/dragonpay-node && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/dragonpay-node/src/index.ts
git commit -m "feat: add public API exports"
```

---

### Task 16: Final verification — typecheck + build + tests

- [ ] **Step 1: Typecheck**

Run: `cd packages/dragonpay-node && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Build**

Run: `cd packages/dragonpay-node && npx tsup`
Expected: Clean build

- [ ] **Step 3: Full test suite**

Run: `cd packages/dragonpay-node && npx vitest run`
Expected: All passing

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final verification — all tests pass, build clean"
```
