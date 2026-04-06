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

  console.log('Creating categories...');
  const starters = await prisma.category.create({ data: { name: 'Starters', image: '/uploads/categories/starters.avif' } });
  const mains = await prisma.category.create({ data: { name: 'Main Course', image: '/uploads/categories/main-course.avif' } });
  const biryani = await prisma.category.create({ data: { name: 'Biryani & Rice', image: '/uploads/categories/biryani-rice.avif' } });
  const beverages = await prisma.category.create({ data: { name: 'Beverages', image: '/uploads/categories/beverages.avif' } });
  const desserts = await prisma.category.create({ data: { name: 'Desserts', image: '/uploads/categories/desserts.avif' } });

  console.log('Creating menu items...');
  const items = [
    // Starters
    { name: 'Paneer Tikka', description: 'Marinated cottage cheese cubes grilled to perfection in a tandoor.', price: 149, image: '/uploads/dishes/paneer-tikka.avif', available: true, isVeg: true, isBestSeller: true, categoryId: starters.id },
    { name: 'Chicken Tikka', description: 'Juicy boneless chicken marinated in spices and yogurt, grilled in tandoor.', price: 179, image: '/uploads/dishes/chicken-tikka.avif', available: true, isVeg: false, isBestSeller: true, categoryId: starters.id },
    { name: 'Samosa (2 pcs)', description: 'Crispy pastry filled with spiced potatoes and peas, served with chutney.', price: 49, image: '/uploads/dishes/samosa.avif', available: true, isVeg: true, isBestSeller: false, categoryId: starters.id },
    { name: 'Masala Dosa', description: 'Crispy rice crepe filled with spiced potato, served with sambar and chutney.', price: 89, image: '/uploads/dishes/masala-dosa.avif', available: true, isVeg: true, isBestSeller: false, categoryId: starters.id },

    // Main Course
    { name: 'Butter Chicken', description: 'Tender chicken in a rich, creamy tomato-based gravy with butter and spices.', price: 249, image: '/uploads/dishes/butter-chicken.avif', available: true, isVeg: false, isBestSeller: true, categoryId: mains.id },
    { name: 'Paneer Butter Masala', description: 'Soft paneer cubes in a luscious tomato-butter gravy with aromatic spices.', price: 199, image: '/uploads/dishes/paneer-butter-masala.avif', available: true, isVeg: true, isBestSeller: true, categoryId: mains.id },
    { name: 'Dal Makhani', description: 'Slow-cooked black lentils and kidney beans in a creamy, buttery gravy.', price: 169, image: '/uploads/dishes/dal-makhani.avif', available: true, isVeg: true, isBestSeller: false, categoryId: mains.id },
    { name: 'Naan (2 pcs)', description: 'Soft leavened bread baked in a tandoor, brushed with butter.', price: 59, image: '/uploads/dishes/naan-bread.avif', available: true, isVeg: true, isBestSeller: false, categoryId: mains.id },

    // Biryani & Rice
    { name: 'Chicken Biryani', description: 'Fragrant basmati rice layered with spiced chicken, saffron, and fried onions.', price: 249, image: '/uploads/dishes/chicken-biryani.avif', available: true, isVeg: false, isBestSeller: true, categoryId: biryani.id },
    { name: 'Mutton Biryani', description: 'Aromatic rice slow-cooked with tender mutton, whole spices, and saffron.', price: 299, image: '/uploads/dishes/mutton-biryani.avif', available: true, isVeg: false, isBestSeller: false, categoryId: biryani.id },
    { name: 'Veg Fried Rice', description: 'Wok-tossed basmati rice with mixed vegetables, soy sauce, and Indo-Chinese spices.', price: 149, image: '/uploads/dishes/veg-fried-rice.avif', available: true, isVeg: true, isBestSeller: false, categoryId: biryani.id },

    // Beverages
    { name: 'Mango Lassi', description: 'Creamy yogurt-based drink blended with sweet Alphonso mango pulp.', price: 79, image: '/uploads/dishes/mango-lassi.avif', available: true, isVeg: true, isBestSeller: false, categoryId: beverages.id },
    { name: 'Cold Coffee', description: 'Chilled coffee blended with milk, ice, and a touch of chocolate.', price: 89, image: '/uploads/dishes/cold-coffee.avif', available: true, isVeg: true, isBestSeller: false, categoryId: beverages.id },
    { name: 'Fresh Lime Soda', description: 'Refreshing drink made with fresh lime juice, soda, and a hint of sugar or salt.', price: 49, image: '/uploads/dishes/fresh-lime-soda.avif', available: true, isVeg: true, isBestSeller: false, categoryId: beverages.id },

    // Desserts
    { name: 'Gulab Jamun (3 pcs)', description: 'Soft, deep-fried milk dumplings soaked in warm cardamom sugar syrup.', price: 79, image: '/uploads/dishes/gulab-jamun.avif', available: true, isVeg: true, isBestSeller: false, categoryId: desserts.id },
    { name: 'Chocolate Truffle Cake', description: 'Rich, moist chocolate cake with silky ganache and dark chocolate shavings.', price: 149, image: '/uploads/dishes/chocolate-cake.avif', available: true, isVeg: true, isBestSeller: false, categoryId: desserts.id },
    { name: 'Vanilla Ice Cream', description: 'Classic vanilla bean ice cream served in a cup with chocolate sauce.', price: 69, image: '/uploads/dishes/ice-cream.avif', available: true, isVeg: true, isBestSeller: false, categoryId: desserts.id },
    { name: 'Truffle Pasta', description: 'Creamy mushroom pasta with truffle oil, parmesan, and fresh herbs. Limited availability.', price: 299, image: null, available: false, isVeg: true, isBestSeller: false, categoryId: mains.id },
  ];

  for (const item of items) {
    await prisma.menuItem.create({ data: { ...item, uid: uid() } });
  }

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

  console.log(`Created ${items.length} menu items in 5 categories.`);
  console.log('Default admin: admin@lazeez.com / admin123');
  console.log('Default user:  user@resto.com / user123');
  console.log('Seeding finished.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
