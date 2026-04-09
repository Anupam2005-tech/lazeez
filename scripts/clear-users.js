const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.savedAddress.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
  console.log('Users and related data deleted successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
