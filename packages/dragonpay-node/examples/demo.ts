import { DragonPayClient } from '../src/index';
import { createMockServer } from '../src/mock-server';

const mock = createMockServer({ port: 4010 });

async function main() {
  await mock.start();

  const dp = new DragonPayClient({
    merchantId: 'TEST',
    password: 'test',
    collectUrl: 'http://localhost:4010/api/collect/v2',
    payoutPassword: 'payout-token',
    payoutUrl: 'http://localhost:4010/api/payout/merchant/v1',
    skipVerification: true,
  });

  // 1. List available processors
  const processors = await dp.getAvailableProcessors(1000);
  console.log('\n📋 Available processors:');
  processors.forEach((p) => console.log(`   ${p.procId} — ${p.longName}`));

  // 2. Create a payment
  const payment = await dp.createPayment('ORDER-001', {
    amount: 1500,
    description: 'Premium subscription',
    email: 'juan@example.com',
    procId: 'GCSH',
  });
  console.log('\n💳 Payment created:');
  console.log(`   Ref: ${payment.refNo}`);
  console.log(`   URL: ${payment.url}`);

  // 3. Check status
  const status = await dp.getTransactionStatus('ORDER-001');
  console.log(`\n📊 Status: ${status.status} — ${status.message}`);

  // 4. Create a payout
  const payout = await dp.createPayout('PAYOUT-001', {
    firstName: 'Juan',
    lastName: 'Cruz',
    amount: 500,
    description: 'Withdrawal',
    email: 'juan@example.com',
    procId: 'BOG',
    procDetail: '1234567890',
  });
  console.log('\n💸 Payout created:');
  console.log(`   Ref: ${payout.refNo}`);
  console.log(`   Status: ${payout.status}`);

  console.log('\n✅ Open the payment URL in your browser to simulate success/failure.');
  console.log('   Press Ctrl+C to stop.\n');
}

main().catch(console.error);
