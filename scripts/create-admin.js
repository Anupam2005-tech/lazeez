const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/create-admin.js <email>');
    console.error('The email must match a user in Firebase Authentication.');
    process.exit(1);
  }

  // The real Firebase UID must be provided or looked up from Firebase Console
  // This script only sets role='admin' for a user that will authenticate via Firebase
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'admin' }
    });
    console.log(`Updated ${email} to admin role.`);
  } else {
    console.log(`No user found with email ${email}.`);
    console.log('The user will be created automatically on first login via Firebase.');
    console.log('After first login, run this script again to set the admin role.');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
