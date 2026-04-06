const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'bhowmikanupam33@gmail.com';
  const uid = 'mock-uid-' + email;
  
  await prisma.user.upsert({
    where: { firebaseUid: uid },
    update: { role: 'admin', name: 'Anupam Admin' },
    create: { firebaseUid: uid, email: email, role: 'admin', name: 'Anupam Admin' }
  });

  await prisma.user.upsert({
    where: { firebaseUid: email },
    update: { role: 'admin' },
    create: { firebaseUid: email, email: email, role: 'admin', name: 'Anupam Admin' }
  });

  console.log('New admin seeded.');
}
main().catch(console.error).finally(()=>prisma.$disconnect());
