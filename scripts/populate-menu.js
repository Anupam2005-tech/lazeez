const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function uid() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function main() {
  console.log('Populating menu with more variety...');

  // 1. Define Categories
  const categoriesData = [
    { name: 'Indo-Chinese', image: '/uploads/categories/chinese.avif' },
    { name: 'South Indian', image: '/uploads/categories/south-indian.avif' },
    { name: 'Healthy & Salads', image: '/uploads/categories/healthy.avif' },
    { name: 'Special Combos', image: '/uploads/categories/combos.avif' },
    { name: 'Continental', image: '/uploads/categories/continental.avif' },
  ];

  const categoryMap = {};

  for (const cat of categoriesData) {
    const category = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categoryMap[cat.name] = category.id;
  }

  // 2. Define items for each category
  const items = [
    // Indo-Chinese
    { name: 'Veg Manchurian', description: 'Deep-fried veg balls in a spicy soy-garlic sauce.', price: 169, image: '/uploads/dishes/veg-manchurian.avif', available: true, isVeg: true, isBestSeller: true, categoryId: categoryMap['Indo-Chinese'] },
    { name: 'Gobi Manchurian', description: 'Crispy cauliflower tossed in a spicy Indo-Chinese sauce.', price: 159, image: '/uploads/dishes/gobi-manchurian.avif', available: true, isVeg: true, isBestSeller: false, categoryId: categoryMap['Indo-Chinese'] },
    { name: 'Hakka Noodles', description: 'Classic stir-fried noodles with fresh vegetables and soy sauce.', price: 179, image: '/uploads/dishes/hakka-noodles.avif', available: true, isVeg: true, isBestSeller: true, categoryId: categoryMap['Indo-Chinese'] },
    { name: 'Schezwan Fried Rice', description: 'Spicy fried rice tossed with Schezwan sauce and crisp veggies.', price: 189, image: '/uploads/dishes/schezwan-rice.avif', available: true, isVeg: true, isBestSeller: false, categoryId: categoryMap['Indo-Chinese'] },
    { name: 'Chilli Chicken', description: 'Juicy chicken pieces tossed with peppers and onions in a spicy sauce.', price: 229, image: '/uploads/dishes/chilli-chicken.avif', available: true, isVeg: false, isBestSeller: true, categoryId: categoryMap['Indo-Chinese'] },
    { name: 'Spring Rolls (4 pcs)', description: 'Crispy rolls filled with sautéed vegetables, served with sweet chilli sauce.', price: 129, image: '/uploads/dishes/spring-rolls.avif', available: true, isVeg: true, isBestSeller: false, categoryId: categoryMap['Indo-Chinese'] },

    // South Indian
    { name: 'Idli Sambar (2 pcs)', description: 'Steamed rice cakes served with aromatic sambar and coconut chutney.', price: 69, image: '/uploads/dishes/idli-sambar.avif', available: true, isVeg: true, isBestSeller: false, categoryId: categoryMap['South Indian'] },
    { name: 'Medu Vada (2 pcs)', description: 'Crispy deep-fried lentil donuts served with sambar and chutney.', price: 79, image: '/uploads/dishes/medu-vada.avif', available: true, isVeg: true, isBestSeller: false, categoryId: categoryMap['South Indian'] },
    { name: 'Mysore Masala Dosa', description: 'Spicy red chutney spread inside a crispy dosa with potato filling.', price: 119, image: '/uploads/dishes/mysore-dosa.avif', available: true, isVeg: true, isBestSeller: true, categoryId: categoryMap['South Indian'] },
    { name: 'Onion Uttapam', description: 'Thick rice pancake topped with chopped onions and green chillies.', price: 99, image: '/uploads/dishes/onion-uttapam.avif', available: true, isVeg: true, isBestSeller: false, categoryId: categoryMap['South Indian'] },

    // Healthy & Salads
    { name: 'Greek Salad', description: 'Fresh cucumbers, tomatoes, olives, and feta cheese with olive oil.', price: 189, image: '/uploads/dishes/greek-salad.avif', available: true, isVeg: true, isBestSeller: false, categoryId: categoryMap['Healthy & Salads'] },
    { name: 'Caesar Salad', description: 'Crispy romaine lettuce, croutons, and parmesan with Caesar dressing.', price: 199, image: '/uploads/dishes/caesar-salad.avif', available: true, isVeg: false, isBestSeller: false, categoryId: categoryMap['Healthy & Salads'] },
    { name: 'Quinoa Protein Bowl', description: 'Nutritious quinoa with roasted veggies, chickpeas, and lemon tahini.', price: 249, image: '/uploads/dishes/quinoa-bowl.avif', available: true, isVeg: true, isBestSeller: true, categoryId: categoryMap['Healthy & Salads'] },

    // Special Combos
    { name: 'Executive Veg Thali', description: 'Paneer, Dal, Mix Veg, Roti, Rice, Curd, and Sweet.', price: 299, image: '/uploads/dishes/veg-thali.avif', available: true, isVeg: true, isBestSeller: true, categoryId: categoryMap['Special Combos'] },
    { name: 'Non-Veg Feast Box', description: 'Butter Chicken, Dal Makhani, 2 Butter Naan, Jeera Rice, and Gulab Jamun.', price: 399, image: '/uploads/dishes/nonveg-combo.avif', available: true, isVeg: false, isBestSeller: true, categoryId: categoryMap['Special Combos'] },
    { name: 'Student Budget Meal', description: 'Veg Fried Rice + Veg Manchurian (Half) + Coke.', price: 149, image: '/uploads/dishes/budget-meal.avif', available: true, isVeg: true, isBestSeller: false, categoryId: categoryMap['Special Combos'] },

    // Continental
    { name: 'Grilled Fish & Veggies', description: 'Lemon-butter grilled fish served with sautéed asparagus and carrots.', price: 449, image: '/uploads/dishes/grilled-fish.avif', available: true, isVeg: false, isBestSeller: false, categoryId: categoryMap['Continental'] },
    { name: 'Creamy Mushroom Risotto', description: 'Arborio rice slow-cooked with wild mushrooms and parmesan.', price: 329, image: '/uploads/dishes/mushroom-risotto.avif', available: true, isVeg: true, isBestSeller: false, categoryId: categoryMap['Continental'] },
    { name: 'Pasta Alfredo', description: 'Fettuccine pasta in a rich garlic-cream sauce with parmesan.', price: 279, image: '/uploads/dishes/pasta-alfredo.avif', available: true, isVeg: true, isBestSeller: true, categoryId: categoryMap['Continental'] },
  ];

  for (const item of items) {
    // We use create because these are new items
    await prisma.menuItem.create({ 
      data: { 
        ...item, 
        uid: uid() 
      } 
    });
  }

  console.log(`Successfully added ${items.length} items across ${categoriesData.length} categories.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
