const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding new categories and items...');

  // Create or get Categories
  const categoriesData = [
    { name: 'Cake' },
    { name: 'Biriyani' },
    { name: 'Pure Veg' },
    { name: 'Beverages' },
    { name: 'Chinese' },
    { name: 'Tea and Coffee' }
  ];

  const categories = {};
  for (const catData of categoriesData) {
    const cat = await prisma.category.upsert({
      where: { name: catData.name },
      update: {},
      create: { name: catData.name },
    });
    categories[catData.name] = cat.id;
  }

  // Create Menu Items
  const itemsData = [
    {
      name: 'Chocolate Truffle Cake',
      description: 'Rich chocolate truffle layer cake, perfect for celebrations.',
      price: 499,
      categoryId: categories['Cake']
    },
    {
      name: 'Black Forest Cake',
      description: 'Classic black forest with cherries and whipped cream.',
      price: 399,
      categoryId: categories['Cake']
    },
    {
      name: 'Hyderabadi Chicken Biriyani',
      description: 'Authentic dum biriyani cooked with fragrant basmati rice and spices.',
      price: 299,
      categoryId: categories['Biriyani']
    },
    {
      name: 'Mutton Dum Biriyani',
      description: 'Tender mutton pieces slowly cooked with biriyani rice.',
      price: 399,
      categoryId: categories['Biriyani']
    },
    {
      name: 'Paneer Butter Masala',
      description: 'Rich and creamy paneer curry.',
      price: 249,
      categoryId: categories['Pure Veg']
    },
    {
      name: 'Veg Kadai',
      description: 'Mixed vegetables cooked with kadai masala.',
      price: 199,
      categoryId: categories['Pure Veg']
    },
    {
      name: 'Fresh Lime Soda',
      description: 'Refreshing sweet and salt lime soda.',
      price: 99,
      categoryId: categories['Beverages']
    },
    {
      name: 'Cold Coffee',
      description: 'Thick and frosty cold coffee.',
      price: 149,
      categoryId: categories['Beverages']
    },
    {
      name: 'Chilli Chicken',
      description: 'Spicy soy-sauce tossed chicken with capsicum.',
      price: 249,
      categoryId: categories['Chinese']
    },
    {
      name: 'Veg Hakka Noodles',
      description: 'Wok tossed noodles with fresh vegetables.',
      price: 179,
      categoryId: categories['Chinese']
    },
    {
      name: 'Masala Chai',
      description: 'Indian spiced tea.',
      price: 49,
      categoryId: categories['Tea and Coffee']
    },
    {
      name: 'Filter Coffee',
      description: 'Traditional South Indian filter coffee.',
      price: 69,
      categoryId: categories['Tea and Coffee']
    }
  ];

  for (const item of itemsData) {
    // Assuming name is not unique in schema, but for seeding we will just create them
    await prisma.menuItem.create({
      data: {
        name: item.name,
        description: item.description,
        price: item.price,
        available: true,
        categoryId: item.categoryId
      }
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
