const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

function uid() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function main() {
  console.log('Clearing old data...');
  await prisma.feedback.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.savedAddress.deleteMany();

  console.log('Creating core infrastructure...');
  
  // Create default settings
  for (const s of [
    { key: 'deliveryRatePer5km', value: '10' },
    { key: 'platformFee', value: '5' },
  ]) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  // Create default admin user (offline auth)
  const adminHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { firebaseUid: 'local-admin-default' },
    update: { password: adminHash, role: 'admin' },
    create: {
      firebaseUid: 'local-admin-default',
      email: 'admin@lazeez.com',
      name: 'Admin',
      password: adminHash,
      role: 'admin',
    },
  });

  // Create default customer user (offline auth)
  const userHash = await bcrypt.hash('user123', 10);
  await prisma.user.upsert({
    where: { firebaseUid: 'local-user-default' },
    update: { password: userHash },
    create: {
      firebaseUid: 'local-user-default',
      email: 'user@resto.com',
      name: 'Test User',
      password: userHash,
      role: 'customer',
    },
  });

  console.log('Infrastructure seeding finished.');
  console.log('Default admin: admin@lazeez.com / admin123');
  console.log('Default user:  user@resto.com / user123');
  console.log('Database is now clean and ready for admin-provided content.');
  console.log('Default admin: admin@lazeez.com / admin123');
  console.log('Default user:  user@resto.com / user123');
  console.log('Seeding finished.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
