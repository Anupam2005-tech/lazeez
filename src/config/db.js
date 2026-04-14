const { PrismaClient } = require('@prisma/client');

// Prisma client singleton — cached globally to survive serverless warm starts
const globalForPrisma = global;

const db = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['info', 'warn', 'error'],
});

// Cache in ALL environments (critical for serverless warm starts)
globalForPrisma.prisma = db;

module.exports = db;
