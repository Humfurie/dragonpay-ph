import * as http from 'http';
import { DragonPayClient } from '../src/index';
import { createMockServer } from '../src/mock-server';

const MOCK_PORT = 4010;
const WEBHOOK_PORT = 3000;

// 1. Start a simple webhook server to receive postbacks
const webhookServer = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/webhook/dragonpay') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = new URLSearchParams(Buffer.concat(chunks).toString('utf-8'));

    console.log('\n📨 Postback received!');
    console.log(`   txnid:   ${body.get('txnid')}`);
    console.log(`   refno:   ${body.get('refno')}`);
    console.log(`   status:  ${body.get('status')}`);
    console.log(`   message: ${body.get('message')}`);
    console.log(`   amount:  ${body.get('amount')}`);
    console.log(`   digest:  ${body.get('digest')}`);

    // Verify the postback using the SDK
    const dp = new DragonPayClient({
      merchantId: 'TEST',
      password: 'test',
      collectUrl: `http://localhost:${MOCK_PORT}/api/collect/v2`,
      skipVerification: false,
    });

    const result = await dp.verifyPostback({
      txnid: body.get('txnid')!,
      refno: body.get('refno')!,
      status: body.get('status')!,
      message: body.get('message')!,
      digest: body.get('digest')!,
      amount: body.get('amount') || undefined,
      ccy: body.get('ccy') || undefined,
      procid: body.get('procid') || undefined,
    });

    console.log(`   verified: ${result.verified}`);

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end();
  }
});

// 2. Start mock DragonPay server with postback URL pointing to our webhook
const mock = createMockServer({
  port: MOCK_PORT,
  merchantId: 'TEST',
  password: 'test',
  postbackUrl: `http://localhost:${WEBHOOK_PORT}/webhook/dragonpay`,
});

async function main() {
  await new Promise<void>((resolve) => webhookServer.listen(WEBHOOK_PORT, resolve));
  console.log(`Webhook server listening on http://localhost:${WEBHOOK_PORT}/webhook/dragonpay`);

  await mock.start();

  const dp = new DragonPayClient({
    merchantId: 'TEST',
    password: 'test',
    collectUrl: `http://localhost:${MOCK_PORT}/api/collect/v2`,
    payoutPassword: 'payout-token',
    payoutUrl: `http://localhost:${MOCK_PORT}/api/payout/merchant/v1`,
    skipVerification: true,
  });

  // List processors
  const processors = await dp.getAvailableProcessors(1000);
  console.log('\nAvailable processors:');
  processors.forEach((p) => console.log(`   ${p.procId} - ${p.longName}`));

  // Create a payment
  const payment = await dp.createPayment('ORDER-001', {
    amount: 1500,
    description: 'Premium subscription',
    email: 'juan@example.com',
    procId: 'GCSH',
  });
  console.log('\nPayment created:');
  console.log(`   Ref: ${payment.refNo}`);
  console.log(`   URL: ${payment.url}`);

  // Check status
  const status = await dp.getTransactionStatus('ORDER-001');
  console.log(`\nStatus: ${status.status} - ${status.message}`);

  // Create a payout
  const payout = await dp.createPayout('PAYOUT-001', {
    firstName: 'Juan',
    lastName: 'Cruz',
    amount: 500,
    description: 'Withdrawal',
    email: 'juan@example.com',
    procId: 'BOG',
    procDetail: '1234567890',
  });
  console.log('\nPayout created:');
  console.log(`   Ref: ${payout.refNo}`);
  console.log(`   Status: ${payout.status}`);

  console.log('\n--- How to test the full flow ---');
  console.log(`1. Open http://localhost:${MOCK_PORT}/pay/ORDER-001`);
  console.log('2. Click "Simulate Success" or "Simulate Failure"');
  console.log('3. Watch the postback appear here in the console');
  console.log('\nPress Ctrl+C to stop.\n');
}

main().catch(console.error);
