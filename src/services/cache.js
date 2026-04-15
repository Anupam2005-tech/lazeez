const NodeCache = require('node-cache');
const db = require('../config/db');
const Trie = require('../utils/trie');

// Upstash Redis client for distributed caching
let upstash = null;
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { Redis } = require('@upstash/redis');
    upstash = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
} catch (e) {
  // Upstash not available, use NodeCache fallback
}

const isDistributed = !!upstash;

// TTL cache for HTML fragments (NodeCache fallback)
const htmlCache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

// TTL constants (in seconds)
const TTL = {
  MENU_ITEMS: 5 * 60,      // 5 minutes
  SITEMAP: 60 * 60,         // 1 hour
  SETTINGS: 30 * 60,        // 30 minutes
  ITEM_RATINGS: 10 * 60,    // 10 minutes
};

// ─── Upstash Helpers ──────────────────────────────────────────────────────────

async function redisGet(key) {
  if (!upstash) return null;
  try {
    const val = await upstash.get(key);
    return val !== null ? JSON.parse(val) : null;
  } catch (e) { return null; }
}

async function redisSet(key, value, ttl) {
  if (!upstash) return false;
  try {
    await upstash.set(key, JSON.stringify(value), { ex: ttl });
    return true;
  } catch (e) { return false; }
}

// ─── AppCache ─────────────────────────────────────────────────────────────────

class AppCache {
  constructor() {
    this.menuMap = new Map();     // Map<categoryId, MenuItem[]>
    this.allMenuItems = [];      // full item list with category
    this.categories = [];
    this.trie = new Trie();
    this.itemRatings = {};       // { itemId: avgRating }
    this.settings = {};          // { key: value }
    this.sitemap = null;
    this.isLoaded = false;
    this.lastMenuRefresh = 0;
    this.lastRatingsRefresh = 0;
    this.lastSettingsRefresh = 0;
    this.lastSitemapRefresh = 0;
  }

  // ── Core Data Loading ───────────────────────────────────────────────────────

  async load() {
    this.categories = await db.category.findMany({ orderBy: { name: 'asc' } });
    this.allMenuItems = await db.menuItem.findMany({
      orderBy: { name: 'asc' },
      include: { category: true }
    });

    this.menuMap.clear();
    this.trie = new Trie();

    for (const item of this.allMenuItems) {
      if (!this.menuMap.has(item.categoryId)) {
        this.menuMap.set(item.categoryId, []);
      }
      this.menuMap.get(item.categoryId).push(item);

      const words = `${item.name} ${item.description || ''}`.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      for (const word of words) {
        this.trie.insert(word, item);
      }
    }

    this.isLoaded = true;
    this.lastMenuRefresh = Date.now();
  }

  async loadRatings() {
    const allFeedback = await db.feedback.findMany({
      select: { foodRating: true, order: { select: { items: { select: { menuItemId: true } } } } }
    });

    const ratingMap = {};
    for (const fb of allFeedback) {
      for (const oi of fb.order.items) {
        if (!ratingMap[oi.menuItemId]) ratingMap[oi.menuItemId] = { sum: 0, count: 0 };
        ratingMap[oi.menuItemId].sum += fb.foodRating;
        ratingMap[oi.menuItemId].count += 1;
      }
    }

    const itemRatings = {};
    for (const [id, data] of Object.entries(ratingMap)) {
      itemRatings[id] = parseFloat((data.sum / data.count).toFixed(1));
    }

    this.itemRatings = itemRatings;
    this.lastRatingsRefresh = Date.now();
  }

  async loadSettings() {
    const settings = await db.setting.findMany();
    const result = {};
    for (const s of settings) result[s.key] = s.value;
    this.settings = result;
    this.lastSettingsRefresh = Date.now();
  }

  // ── Public Getters ─────────────────────────────────────────────────────────

  async getMenuItems() {
    const stale = Date.now() - this.lastMenuRefresh > TTL.MENU_ITEMS * 1000;
    if (!this.isLoaded || stale) await this.load();
    return this.allMenuItems;
  }

  async getCategories() {
    const stale = Date.now() - this.lastMenuRefresh > TTL.MENU_ITEMS * 1000;
    if (!this.isLoaded || stale) await this.load();
    return this.categories;
  }

  async getMenuMap() {
    const stale = Date.now() - this.lastMenuRefresh > TTL.MENU_ITEMS * 1000;
    if (!this.isLoaded || stale) await this.load();
    return this.menuMap;
  }

  async getItemRatings() {
    const stale = Date.now() - this.lastRatingsRefresh > TTL.ITEM_RATINGS * 1000;
    if (!this.itemRatings || stale) await this.loadRatings();
    return this.itemRatings;
  }

  async getSettings() {
    const stale = Date.now() - this.lastSettingsRefresh > TTL.SETTINGS * 1000;
    if (Object.keys(this.settings).length === 0 || stale) await this.loadSettings();
    return this.settings;
  }

  async getSitemap() {
    const stale = Date.now() - this.lastSitemapRefresh > TTL.SITEMAP * 1000;
    if (!this.sitemap || stale) await this.buildSitemap();
    return this.sitemap;
  }

  async search(query) {
    const stale = Date.now() - this.lastMenuRefresh > TTL.MENU_ITEMS * 1000;
    if (!this.isLoaded || stale) await this.load();
    if (!query) return [];

    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return [];

    let results = this.trie.searchPrefix(words[0]);
    for (let i = 1; i < words.length; i++) {
      const wordResults = this.trie.searchPrefix(words[i]);
      results = results.filter(item1 => wordResults.find(item2 => item2.id === item1.id));
    }
    return results;
  }

  // ── Sitemap Builder ────────────────────────────────────────────────────────

  async buildSitemap() {
    const siteUrl = process.env.SITE_URL || 'https://lazeez.com';
    const now = new Date().toISOString();

    const categories = await this.getCategories();
    const menuItems = await this.getMenuItems();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    const staticUrls = [
      { loc: '/', changefreq: 'daily', priority: '1.0' },
      { loc: '/menu', changefreq: 'daily', priority: '0.9' },
      { loc: '/offers', changefreq: 'weekly', priority: '0.8' },
      { loc: '/terms', changefreq: 'monthly', priority: '0.4' },
      { loc: '/privacy', changefreq: 'monthly', priority: '0.4' },
    ];

    for (const u of staticUrls) {
      xml += `  <url><loc>${siteUrl}${u.loc}</loc><lastmod>${now}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>\n`;
    }

    for (const cat of categories) {
      xml += `  <url><loc>${siteUrl}/category/${cat.id}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    }

    for (const item of menuItems) {
      if (item.available) {
        xml += `  <url>\n    <loc>${siteUrl}/item/${item.uid}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>`;
        if (item.image) {
          const imgLoc = item.image.startsWith('http') ? item.image : siteUrl + item.image;
          const imgTitle = (item.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          xml += `\n    <image:image>\n      <image:loc>${imgLoc}</image:loc>\n      <image:title>${imgTitle}</image:title>\n    </image:image>`;
        }
        xml += `\n  </url>\n`;
      }
    }

    xml += '</urlset>';
    this.sitemap = xml;
    this.lastSitemapRefresh = Date.now();
  }

  // ── HTML Fragment Cache ─────────────────────────────────────────────────────

  getHtml(key) { return htmlCache.get(key); }
  setHtml(key, html, ttl = 60) {
    htmlCache.set(key, html, ttl);
    if (isDistributed) redisSet('html:' + key, html, ttl);
  }

  // ── Refresh Triggers ──────────────────────────────────────────────────────

  async refresh() {
    this.isLoaded = false;
    this.itemRatings = {};
    this.settings = {};
    this.sitemap = null;
    htmlCache.flushAll();
    await this.load();
  }

  async refreshRatings() {
    await this.loadRatings();
  }

  async refreshSettings() {
    await this.loadSettings();
  }
}

module.exports = new AppCache();
