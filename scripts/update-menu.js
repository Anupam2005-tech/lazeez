const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const updates = [
  { contains: 'biryani', image: null, factor: 80 },
  { contains: 'pizza', image: null, factor: 80 },
  { contains: 'burger', image: null, factor: 80 },
  { contains: 'salad', image: null, factor: 80 },
  { contains: 'roll', image: null, factor: 80 },
  { contains: 'fries', image: null, factor: 80 },
  { contains: 'wrap', image: null, factor: 80 },
  // Default override
  { contains: '', image: null, factor: 80 }, 
];

async function main() {
  const items = await prisma.menuItem.findMany();
  for (const item of items) {
    let matched = updates.find(u => item.name.toLowerCase().includes(u.contains));
    if (!matched) matched = updates[updates.length - 1]; // fallback

    // Scale price from old dummy (e.g. 10.00 -> 800) if it's currently low
    let newPrice = item.price;
    if (newPrice < 100) {
      newPrice = Math.round(newPrice * matched.factor);
    }

    await prisma.menuItem.update({
      where: { id: item.id },
      data: {
        price: newPrice,
        image: matched.image
      }
    });
    console.log(`Updated ${item.name} -> ₹${newPrice}`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
