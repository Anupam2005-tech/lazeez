const db = require('../config/db');
const appCache = require('../services/cache');

async function index(req, res) {
  try {
    const { category, search } = req.query;
    const rawFoodType = (req.query.foodType || 'all').toString().toLowerCase();
    const foodType = ['nonveg', 'bestseller', 'veg'].includes(rawFoodType) ? rawFoodType : 'all';

    // Retrieve via In-Memory HashMaps instead of querying DB
    const categories = await appCache.getCategories();
    let allMenuItems = await appCache.getMenuItems();

    // Get cached item ratings (no DB query)
    const itemRatings = await appCache.getItemRatings();

    // Serialize all items for client-side filtering (include ratings)
    const allItemsJSON = JSON.stringify(allMenuItems.map(item => ({
      id: item.id, uid: item.uid, name: item.name, price: item.price,
      image: item.image, description: item.description, isVeg: item.isVeg,
      isBestSeller: item.isBestSeller, available: item.available,
      categoryId: item.categoryId, categoryName: item.category ? item.category.name : null,
      avgRating: itemRatings[item.id] || 0
    })));

    // In-memory highly optimized filtering
    let menuItems = allMenuItems;
    if (category) {
      // O(1) map fetch
      const menuMap = await appCache.getMenuMap();
      menuItems = menuMap.get(category) || [];
    }
    
    if (foodType === 'veg') menuItems = menuItems.filter(i => i.isVeg);
    else if (foodType === 'nonveg') menuItems = menuItems.filter(i => !i.isVeg);
    else if (foodType === 'bestseller') menuItems = menuItems.filter(i => i.isBestSeller);
    
    // Trie search integration for base render
    if (search) {
      menuItems = await appCache.search(search);
      if(foodType === 'veg') menuItems = menuItems.filter(i => i.isVeg);
      else if (foodType === 'nonveg') menuItems = menuItems.filter(i => !i.isVeg);
      else if (foodType === 'bestseller') menuItems = menuItems.filter(i => i.isBestSeller);
    }

    const siteUrl = process.env.SITE_URL || 'https://lazeez.com';
    const homeDescription = search
      ? 'Search results for "' + search + '" at Lazeez. Order delicious food online with fresh ingredients and authentic recipes.'
      : (category
        ? 'Order ' + (categories.find(c => c.id === category)?.name || 'menu') + ' online from Lazeez. Fresh ingredients, authentic recipes, and fast delivery.'
        : 'Order delicious food online from Lazeez. Fresh ingredients, authentic recipes, and fast delivery. Browse our full menu and order now!');

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: 'Lazeez',
      url: siteUrl,
      servesCuisine: 'Multi-cuisine',
      priceRange: '$$',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Agartala',
        addressCountry: 'IN'
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.3',
        reviewCount: '1300'
      }
    };

    res.render('storefront/home', {
      title: search ? 'Search: ' + search : (category ? categories.find(c => c.id === category)?.name : 'Home'),
      categories,
      menuItems,
      allItemsJSON,
      currentCategory: category ? category : null,
      searchQuery: search || '',
      currentFoodType: foodType,
      itemRatings,
      metaDescription: homeDescription,
      canonicalUrl: search ? '/?search=' + encodeURIComponent(search) : (category ? '/category/' + category : '/'),
      ogType: 'website',
      structuredData
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading home');
  }
}

async function categoryPage(req, res) {
  try {
    const categoryId = req.params.id;
    const rawFoodType = (req.query.foodType || 'all').toString().toLowerCase();
    const foodType = ['nonveg', 'bestseller', 'veg'].includes(rawFoodType) ? rawFoodType : 'all';

    const categories = await appCache.getCategories();
    const allMenuItems = await appCache.getMenuItems();
    const category = categories.find(c => c.id === categoryId);

    if (!category) return res.status(404).render('storefront/404', { title: 'Category Not Found', robots: 'noindex, nofollow' });

    const allItemsJSON = JSON.stringify(allMenuItems.map(item => ({
      id: item.id, uid: item.uid, name: item.name, price: item.price,
      image: item.image, description: item.description, isVeg: item.isVeg,
      isBestSeller: item.isBestSeller, available: item.available,
      categoryId: item.categoryId, categoryName: item.category ? item.category.name : null
    })));

    const menuMap = await appCache.getMenuMap();
    let menuItems = menuMap.get(categoryId) || [];
    
    if (foodType === 'veg') menuItems = menuItems.filter(i => i.isVeg);
    else if (foodType === 'nonveg') menuItems = menuItems.filter(i => !i.isVeg);
    else if (foodType === 'bestseller') menuItems = menuItems.filter(i => i.isBestSeller);

    // Get cached item ratings (no DB query)
    const itemRatings = await appCache.getItemRatings();

    const siteUrl = process.env.SITE_URL || 'https://lazeez.com';
    const catDescription = 'Order ' + category.name + ' online from Lazeez. ' + menuItems.length + ' dishes available. Fresh ingredients, authentic recipes, and fast delivery.';

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: category.name + ' - Lazeez',
      url: siteUrl + '/category/' + category.id,
      numberOfItems: menuItems.length,
      itemListElement: menuItems.slice(0, 10).map(function(item, index) {
        return {
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'MenuItem',
            name: item.name,
            description: item.description || undefined,
            offers: {
              '@type': 'Offer',
              price: item.price.toString(),
              priceCurrency: 'INR'
            }
          }
        };
      })
    };

    res.render('storefront/category', {
      title: category.name,
      category,
      categories,
      menuItems,
      allItemsJSON,
      currentFoodType: foodType,
      itemRatings,
      metaDescription: catDescription,
      canonicalUrl: '/category/' + category.id,
      ogImage: category.image ? siteUrl + category.image : undefined,
      ogType: 'website',
      structuredData
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading category');
  }
}

async function itemDetail(req, res) {
  try {
    const uid = req.params.uid;
    const allMenuItems = await appCache.getMenuItems();
    const item = allMenuItems.find(i => i.uid === uid);
    
    if (!item) return res.status(404).render('storefront/404', { title: 'Not Found', robots: 'noindex, nofollow' });

    // Fetch reviews for orders that include this menu item
    const reviews = await db.feedback.findMany({
      where: {
        order: { items: { some: { menuItemId: item.id } } }
      },
      include: {
        user: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0
      ? parseFloat((reviews.reduce((sum, r) => sum + r.foodRating, 0) / totalReviews).toFixed(1))
      : 0;

    const siteUrl = process.env.SITE_URL || 'https://lazeez.com';
    const itemDesc = item.description || 'Order ' + item.name + ' online from Lazeez. Delicious ' + (item.category ? item.category.name : 'dish') + ' at just Rs.' + item.price + '.';

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'MenuItem',
      name: item.name,
      description: item.description || undefined,
      image: item.image ? siteUrl + item.image : undefined,
      offers: {
        '@type': 'Offer',
        price: item.price.toString(),
        priceCurrency: 'INR',
        availability: item.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
      },
      category: item.category ? item.category.name : undefined,
      suitableForDiet: item.isVeg ? 'https://schema.org/VeganDiet' : undefined
    };

    res.render('storefront/item-detail', {
      title: item.name,
      item: {
        id: item.id, uid: item.uid, name: item.name, price: item.price,
        image: item.image, description: item.description, isVeg: item.isVeg,
        isBestSeller: item.isBestSeller, available: item.available,
        categoryId: item.categoryId, categoryName: item.category ? item.category.name : null
      },
      avgRating,
      totalReviews,
      reviews: reviews.map(r => ({
        foodRating: r.foodRating,
        comment: r.comment,
        userName: r.user.name || 'Anonymous',
        createdAt: r.createdAt
      })),
      metaDescription: itemDesc,
      canonicalUrl: '/item/' + item.uid,
      ogImage: item.image ? siteUrl + item.image : undefined,
      ogType: 'article',
      structuredData
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading item');
  }
}

// Optimized partial JSON search using O(L) Trie
async function search(req, res) {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const results = await appCache.search(q);
    
    // Sort logic (exact matches or startsWith prioritize)
    const qLower = q.toLowerCase();
    const scored = results.map(item => {
      let score = 10;
      if (item.name.toLowerCase().startsWith(qLower)) score += 100;
      else if (item.name.toLowerCase().includes(qLower)) score += 50;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, 10)
    .map(({ item }) => ({
       id: item.id, uid: item.uid, name: item.name, price: item.price,
       image: item.image, description: item.description, available: item.available,
       category: item.category ? item.category.name : null
    }));

    res.json(scored);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
}

async function apiMenuItems(req, res) {
  try {
    const { category, search } = req.query;
    const rawFoodType = (req.query.foodType || 'all').toString().toLowerCase();
    const foodType = ['nonveg', 'bestseller', 'veg'].includes(rawFoodType) ? rawFoodType : 'all';

    let items = await appCache.getMenuItems();

    if (category) {
       const menuMap = await appCache.getMenuMap();
       items = menuMap.get(category) || [];
    }
    
    if (search) {
      items = await appCache.search(search);
      if(category) items = items.filter(i => i.categoryId === category);
    }
    
    if (foodType === 'veg') items = items.filter(i => i.isVeg);
    else if (foodType === 'nonveg') items = items.filter(i => !i.isVeg);
    else if (foodType === 'bestseller') items = items.filter(i => i.isBestSeller);

    // Get cached item ratings (no DB query)
    const cachedRatings = await appCache.getItemRatings();

    const result = items.map(item => ({
      id: item.id, uid: item.uid, name: item.name, price: item.price,
      image: item.image, description: item.description, isVeg: item.isVeg,
      isBestSeller: item.isBestSeller, available: item.available,
      categoryId: item.categoryId, categoryName: item.category ? item.category.name : null,
      avgRating: cachedRatings[item.id] || 0
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
}


async function menuPage(req, res) {
  try {
    const { category, search, foodType } = req.query;
    const categories = await appCache.getCategories();
    let menuItems = await appCache.getMenuItems();

    if (category) {
      menuItems = menuItems.filter(i => i.categoryId === category);
    }

    if (foodType === 'veg') {
      menuItems = menuItems.filter(i => i.isVeg);
    } else if (foodType === 'nonveg') {
      menuItems = menuItems.filter(i => !i.isVeg);
    } else if (foodType === 'bestseller') {
      menuItems = menuItems.filter(i => i.isBestSeller);
    }

    if (search) {
      menuItems = await appCache.search(search);
    }

    const serialized = menuItems.map(item => ({
      id: item.id, uid: item.uid, name: item.name, price: item.price,
      image: item.image, description: item.description, isVeg: item.isVeg,
      isBestSeller: item.isBestSeller, available: item.available,
      categoryId: item.categoryId, category: item.category ? item.category.name : null
    }));

    const siteUrl = process.env.SITE_URL || 'https://lazeez.com';
    const menuDescription = 'Browse the full menu at Lazeez. ' + menuItems.length + ' dishes available including pizzas, fast food, North Indian and more. Order online now!';

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: 'Lazeez',
      url: siteUrl,
      menu: {
        '@type': 'Menu',
        name: 'Lazeez Menu',
        url: siteUrl + '/menu',
        hasMenuSection: categories.map(function(cat) {
          return {
            '@type': 'MenuSection',
            name: cat.name
          };
        })
      }
    };

    res.render('storefront/menu', {
      title: 'Full Menu',
      categories,
      menuItems: serialized,
      currentCategory: category || null,
      currentFoodType: foodType || 'all',
      searchQuery: search || '',
      metaDescription: menuDescription,
      canonicalUrl: '/menu',
      structuredData
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading menu');
  }
}

module.exports = { index, categoryPage, itemDetail, search, apiMenuItems, menuPage };
