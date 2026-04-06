class TrieNode {
  constructor() {
    this.children = {};
    this.items = []; // Store references to menu items for faster subset matching
    this.isEndOfWord = false;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word, item) {
    if (!word) return;
    const lowerWord = word.toLowerCase();
    let current = this.root;
    for (const char of lowerWord) {
      if (!current.children[char]) {
        current.children[char] = new TrieNode();
      }
      current = current.children[char];
      // Store item at every node for instant prefix matching (O(L))
      // Use a basic inclusion check to avoid memory bloat
      if (!current.items.find(i => i.id === item.id)) {
        current.items.push(item);
      }
    }
    current.isEndOfWord = true;
  }

  // Returns all items that match the prefix
  searchPrefix(prefix) {
    if (!prefix) return [];
    const lowerPrefix = prefix.toLowerCase();
    let current = this.root;
    for (const char of lowerPrefix) {
      if (!current.children[char]) return [];
      current = current.children[char];
    }
    return current.items;
  }
}

module.exports = Trie;
