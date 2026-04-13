const NodeCache = require('node-cache');
const db = require('../config/db');
const Trie = require('../utils/trie');

// TTL cache for HTML fragments: 60 seconds
const htmlCache = new NodeCache({ stdTTL: 60 });

class AppCache {
  constructor() {
    this.menuMap = new Map(); // Map<categoryId, MenuItem[]>
    this.allMenuItems = [];
    this.categories = [];
    this.trie = new Trie();
    this.isLoaded = false;
  }

  async load() {
    this.categories = await db.category.findMany({ orderBy: { name: 'asc' } });
    this.allMenuItems = await db.menuItem.findMany({
      orderBy: { name: 'asc' },
      include: { category: true }
    });

    this.menuMap.clear();
    this.trie = new Trie();

    for (const item of this.allMenuItems) {
      // In-Memory HashMap mapping categoryId -> MenuItem[]
      if (!this.menuMap.has(item.categoryId)) {
        this.menuMap.set(item.categoryId, []);
      }
      this.menuMap.get(item.categoryId).push(item);

      // Populate Trie with words from name and description
      const words = `${item.name} ${item.description || ''}`.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      for (const word of words) {
        this.trie.insert(word, item);
      }
    }
    this.isLoaded = true;
  }

  async getMenuItems() {
    if (!this.isLoaded) await this.load();
    return this.allMenuItems;
  }

  async getCategories() {
    if (!this.isLoaded) await this.load();
    return this.categories;
  }
  
  async getMenuMap() {
    if (!this.isLoaded) await this.load();
    return this.menuMap;
  }

  async search(query) {
    if (!this.isLoaded) await this.load();
    if (!query) return [];
    
    // O(L) prefix search using Trie for multi-word queries
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if(words.length === 0) return [];
    
    let results = this.trie.searchPrefix(words[0]);
    for(let i = 1; i < words.length; i++) {
        const wordResults = this.trie.searchPrefix(words[i]);
        // Set intersection for multi-word matches
        results = results.filter(item1 => wordResults.find(item2 => item2.id === item1.id));
    }
    return results;
  }

  async refresh() {
    this.isLoaded = false;
    htmlCache.flushAll(); 
    await this.load().catch(console.error);
  }

  getHtml(key) { return htmlCache.get(key); }
  setHtml(key, html) { htmlCache.set(key, html); }
}

module.exports = new AppCache();
