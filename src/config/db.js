const { PrismaClient } = require('@prisma/client');

// Prisma client singleton for development
const globalForPrisma = global;

const db = globalForPrisma.prisma || new PrismaClient({
  log: ['info', 'warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

module.exports = db;
