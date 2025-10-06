const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    await prisma.subscription.create({
      data: {
        stripeSubscriptionId: 'test_sub',
        stripePriceId: 'test_price',
        stripeCustomerId: 'test_cust',
        organizationId: 'cmc3e5qem0004kz7sxsgldv9f', // Use a valid organizationId from your DB
        status: 'TRIALING',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      }
    });
    console.log('Success!');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

test(); 