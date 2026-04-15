const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function generateSitemap() {
  const siteUrl = process.env.SITE_URL || 'https://lazeez.com';
  const now = new Date().toISOString();

  const categories = await db.category.findMany({ orderBy: { name: 'asc' } });
  const menuItems = await db.menuItem.findMany({ orderBy: { name: 'asc' } });

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

  const staticUrls = [
    { loc: '/', changefreq: 'daily', priority: '1.0' },
    { loc: '/menu', changefreq: 'daily', priority: '0.9' },
    { loc: '/offers', changefreq: 'weekly', priority: '0.8' },
    { loc: '/terms', changefreq: 'monthly', priority: '0.4' },
    { loc: '/privacy', changefreq: 'monthly', priority: '0.4' },
  ];

  for (const u of staticUrls) {
    xml += `  <url>
    <loc>${siteUrl}${u.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>\n`;
  }

  for (const cat of categories) {
    xml += `  <url>
    <loc>${siteUrl}/category/${cat.id}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  }

  for (const item of menuItems) {
    if (item.available) {
      xml += `  <url>
    <loc>${siteUrl}/item/${item.uid}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>`;
      
      if (item.image) {
        xml += `
    <image:image>
      <image:loc>${item.image.startsWith('http') ? item.image : siteUrl + item.image}</image:loc>
      <image:title>${item.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</image:title>
    </image:image>`;
      }
      
      xml += `\n  </url>\n`;
    }
  }

  xml += '</urlset>';

  if (!fs.existsSync(path.join(__dirname, '../public'))) {
    fs.mkdirSync(path.join(__dirname, '../public'));
  }
  fs.writeFileSync(path.join(__dirname, '../public/sitemap.xml'), xml);
  console.log('Sitemap successfully generated at public/sitemap.xml');
  process.exit(0);
}

generateSitemap().catch(e => {
  console.error(e);
  process.exit(1);
});
