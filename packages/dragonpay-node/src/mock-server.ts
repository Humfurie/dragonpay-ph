import * as http from 'http';
import * as crypto from 'crypto';

interface MockTransaction {
  txnId: string;
  refNo: string;
  status: string;
  message: string;
  amount: string;
  email: string;
  procId?: string;
  type: 'collection' | 'payout';
}

interface MockServerOptions {
  port?: number;
  /** Merchant ID to accept (default: any) */
  merchantId?: string;
  /** Password to accept (default: any) */
  password?: string;
  /** URL to POST postback callbacks to (e.g., http://localhost:3000/webhook/dragonpay) */
  postbackUrl?: string;
}

export function createMockServer(options: MockServerOptions = {}) {
  const port = options.port || 4010;
  const transactions = new Map<string, MockTransaction>();
  let refCounter = 1000;

  function generateRefNo(): string {
    return `MOCK-REF-${++refCounter}`;
  }

  function parseBasicAuth(header: string | undefined): { merchantId: string; password: string } | null {
    if (!header?.startsWith('Basic ')) return null;
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
    const [merchantId, password] = decoded.split(':');
    return { merchantId, password };
  }

  function parseBearerAuth(header: string | undefined): string | null {
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7);
  }

  function json(res: http.ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  async function sendPostback(txn: MockTransaction): Promise<void> {
    if (!options.postbackUrl) return;

    const password = options.password || 'test';
    const digestStr = `${txn.txnId}:${txn.refNo}:${txn.status}:${txn.message}:${password}`;
    const digest = crypto.createHash('sha1').update(digestStr).digest('hex');

    const params = new URLSearchParams({
      txnid: txn.txnId,
      refno: txn.refNo,
      status: txn.status,
      message: txn.message,
      digest,
      amount: txn.amount,
      ccy: 'PHP',
      procid: txn.procId || '',
    });

    try {
      const resp = await fetch(options.postbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      console.log(`Postback sent to ${options.postbackUrl} -> ${resp.status}`);
    } catch (err) {
      console.log(`Postback failed: ${err}`);
    }
  }

  async function sendPayoutPostback(txn: MockTransaction): Promise<void> {
    if (!options.postbackUrl) return;

    const password = options.password || 'test';
    const digestStr = `${txn.txnId}:${txn.refNo}:${txn.status}:${txn.message}:${password}`;
    const digest = crypto.createHash('sha1').update(digestStr).digest('hex');

    const params = new URLSearchParams({
      merchantTxnId: txn.txnId,
      refNo: txn.refNo,
      status: txn.status,
      message: txn.message,
      digest,
    });

    try {
      const resp = await fetch(options.postbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      console.log(`Payout postback sent to ${options.postbackUrl} -> ${resp.status}`);
    } catch (err) {
      console.log(`Payout postback failed: ${err}`);
    }
  }

  async function readBody(req: http.IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const path = url.pathname;

    // === Collection API: POST /{txnId}/post ===
    if (req.method === 'POST' && path.match(/^\/api\/collect\/v2\/(.+)\/post$/)) {
      const auth = parseBasicAuth(req.headers.authorization);
      if (!auth) return json(res, 401, { Status: -1, Message: 'Unauthorized' });
      if (options.merchantId && auth.merchantId !== options.merchantId) {
        return json(res, 401, { Status: -1, Message: 'Invalid merchant' });
      }

      const txnId = path.match(/^\/api\/collect\/v2\/(.+)\/post$/)![1];
      if (transactions.has(txnId)) {
        return json(res, 400, { Status: -2, Message: `Duplicate transaction ID: ${txnId}` });
      }

      const body = JSON.parse(await readBody(req));
      const refNo = generateRefNo();

      transactions.set(txnId, {
        txnId,
        refNo,
        status: 'P',
        message: 'Pending',
        amount: body.Amount || '0.00',
        email: body.Email || '',
        procId: body.ProcId,
        type: 'collection',
      });

      return json(res, 200, {
        RefNo: refNo,
        Status: 'S',
        Message: 'Payment created',
        Url: `http://localhost:${port}/pay/${txnId}`,
      });
    }

    // === Collection API: GET /{txnId} (status) ===
    if (req.method === 'GET' && path.match(/^\/api\/collect\/v2\/([^/]+)$/) && !path.includes('processors') && !path.includes('keys')) {
      const txnId = path.match(/^\/api\/collect\/v2\/([^/]+)$/)![1];
      const txn = transactions.get(txnId);
      if (!txn) return json(res, 404, { Status: -1, Message: 'Transaction not found' });

      return json(res, 200, {
        RefNo: txn.refNo,
        Status: txn.status,
        Message: txn.message,
      });
    }

    // === Collection API: GET /{txnId}/void ===
    if (req.method === 'GET' && path.match(/^\/api\/collect\/v2\/(.+)\/void$/)) {
      const txnId = path.match(/^\/api\/collect\/v2\/(.+)\/void$/)![1];
      const txn = transactions.get(txnId);
      if (!txn) return json(res, 404, { Status: -1, Message: 'Transaction not found' });

      txn.status = 'V';
      txn.message = 'Voided';
      return json(res, 200, { Status: 0, Message: 'Voided' });
    }

    // === Collection API: GET /processors/{amount} ===
    if (req.method === 'GET' && path.match(/^\/api\/collect\/v2\/processors\//)) {
      return json(res, 200, [
        { ProcId: 'GCSH', ShortName: 'GCash', LongName: 'GCash via DragonPay', Logo: '', Currencies: ['PHP'], MinAmount: 1, MaxAmount: 50000 },
        { ProcId: 'PYMY', ShortName: 'Maya', LongName: 'Maya (PayMaya)', Logo: '', Currencies: ['PHP'], MinAmount: 1, MaxAmount: 50000 },
        { ProcId: 'BPI', ShortName: 'BPI', LongName: 'Bank of the Philippine Islands', Logo: '', Currencies: ['PHP'], MinAmount: 1, MaxAmount: 1000000 },
        { ProcId: 'BDO', ShortName: 'BDO', LongName: 'Banco de Oro', Logo: '', Currencies: ['PHP'], MinAmount: 1, MaxAmount: 1000000 },
        { ProcId: 'GRAB', ShortName: 'GrabPay', LongName: 'GrabPay', Logo: '', Currencies: ['PHP'], MinAmount: 1, MaxAmount: 50000 },
        { ProcId: '7ELE', ShortName: '7-Eleven', LongName: '7-Eleven CLIQQ', Logo: '', Currencies: ['PHP'], MinAmount: 100, MaxAmount: 10000 },
      ]);
    }

    // === Collection API: GET /v1/keys/callback ===
    if (req.method === 'GET' && path.match(/\/api\/collect\/v1\/keys\/callback/)) {
      // Return a mock RSA public key
      const { publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      return json(res, 200, [
        { value: (publicKey as Buffer).toString('base64'), status: 'Active' },
      ]);
    }

    // === Payout API: POST /{merchantId}/post ===
    if (req.method === 'POST' && path.match(/^\/api\/payout\/merchant\/v1\/(.+)\/post$/)) {
      const bearerToken = parseBearerAuth(req.headers.authorization);
      if (!bearerToken) return json(res, 401, { Code: -1, Message: 'Unauthorized' });

      const body = JSON.parse(await readBody(req));
      const txnId = body.TxnId;

      if (transactions.has(txnId)) {
        return json(res, 200, { Code: -2, Message: `Duplicate transaction ID: ${txnId}` });
      }

      const refNo = generateRefNo();

      transactions.set(txnId, {
        txnId,
        refNo,
        status: 'Q',
        message: 'Queued',
        amount: body.Amount || '0.00',
        email: body.Email || '',
        procId: body.ProcId,
        type: 'payout',
      });

      return json(res, 200, { Code: 0, Message: refNo });
    }

    // === Payout API: GET /{merchantId}/{txnId} (status) ===
    if (req.method === 'GET' && path.match(/^\/api\/payout\/merchant\/v1\/([^/]+)\/([^/]+)$/)) {
      const txnId = path.match(/^\/api\/payout\/merchant\/v1\/([^/]+)\/([^/]+)$/)![2];
      const txn = transactions.get(txnId);
      if (!txn) return json(res, 404, { Status: -1, Message: 'Transaction not found' });

      return json(res, 200, {
        RefNo: txn.refNo,
        Status: txn.status,
        Message: txn.message,
      });
    }

    // === Root / landing page ===
    if (path === '/' || path === '') {
      const txnList = [...transactions.values()];
      const rows = txnList.length > 0
        ? txnList.map((t) => {
          const settled = ['S', 'F', 'V'].includes(t.status);
          let action = '&mdash;';
          if (!settled) {
            action = t.type === 'collection'
              ? `<a href="/pay/${t.txnId}">Pay</a>`
              : `<a href="/simulate/${t.txnId}/success">Success</a> | <a href="/simulate/${t.txnId}/failure">Fail</a>`;
          }
          return `<tr><td>${t.txnId}</td><td>${t.type}</td><td>${t.status}</td><td>${t.amount}</td><td>${action}</td></tr>`;
        }).join('')
        : '<tr><td colspan="5">No transactions yet. Use the SDK to create one.</td></tr>';

      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>DragonPay Mock Server</title></head>
<body style="font-family: sans-serif; max-width: 640px; margin: 40px auto; padding: 20px;">
  <h2>DragonPay Mock Server</h2>
  <p>This is a local mock of the DragonPay API for development.</p>
  <h3>Transactions</h3>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
    <tr><th>TxnId</th><th>Type</th><th>Status</th><th>Amount</th><th>Action</th></tr>
    ${rows}
  </table>
</body>
</html>`);
    }

    // === Ignore favicon ===
    if (path === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }

    // === Mock payment page ===
    if (req.method === 'GET' && path.match(/^\/pay\/(.+)$/)) {
      const txnId = path.match(/^\/pay\/(.+)$/)![1];
      const txn = transactions.get(txnId);
      if (!txn) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Transaction not found');
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Mock DragonPay Payment</title></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 40px auto; padding: 20px;">
  <h2>Mock DragonPay Payment</h2>
  <p><strong>Transaction:</strong> ${txnId}</p>
  <p><strong>Amount:</strong> PHP ${txn.amount}</p>
  <p><strong>Processor:</strong> ${txn.procId || 'Any'}</p>
  <p><strong>Email:</strong> ${txn.email}</p>
  <hr>
  <p>In a real integration, the customer would complete payment here.</p>
  <p>
    <a href="/simulate/${txnId}/success">Simulate Success</a> |
    <a href="/simulate/${txnId}/failure">Simulate Failure</a>
  </p>
</body>
</html>`);
    }

    // === Simulate payment outcome ===
    if (req.method === 'GET' && path.match(/^\/simulate\/(.+)\/(success|failure)$/)) {
      const match = path.match(/^\/simulate\/(.+)\/(success|failure)$/)!;
      const txnId = match[1];
      const outcome = match[2];
      const txn = transactions.get(txnId);
      if (!txn) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Transaction not found');
      }

      txn.status = outcome === 'success' ? 'S' : 'F';
      txn.message = outcome === 'success'
        ? (txn.type === 'payout' ? 'Payout successful' : 'Payment successful')
        : (txn.type === 'payout' ? 'Payout failed' : 'Payment failed');

      // Fire postback to merchant's webhook
      if (txn.type === 'payout') {
        sendPayoutPostback(txn);
      } else {
        sendPostback(txn);
      }

      const label = txn.type === 'payout' ? 'Payout' : 'Payment';
      const postbackInfo = options.postbackUrl
        ? `<p>Postback sent to <code>${options.postbackUrl}</code></p>`
        : '<p>No postbackUrl configured. Set it in createMockServer options to receive callbacks.</p>';

      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 40px auto; padding: 20px;">
  <h2>${label} ${outcome === 'success' ? 'Successful' : 'Failed'}</h2>
  <p>Transaction ${txnId} is now <strong>${txn.status}</strong>.</p>
  ${postbackInfo}
  <p><a href="/">Back to dashboard</a></p>
</body>
</html>`);
    }

    // === Fallback ===
    json(res, 404, { Status: -1, Message: 'Not found' });
  });

  return {
    start: () =>
      new Promise<void>((resolve) => {
        server.listen(port, () => {
          console.log(`DragonPay mock server running on http://localhost:${port}`);
          resolve();
        });
      }),
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
    /** Get all transactions (for assertions in tests) */
    getTransactions: () => new Map(transactions),
    /** Reset all state */
    reset: () => {
      transactions.clear();
      refCounter = 1000;
    },
    server,
    port,
  };
}
