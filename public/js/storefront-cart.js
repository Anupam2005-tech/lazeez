(function () {
  // Initialize cart state from server
  window.RestoCartState = window.RestoCartState || { items: [], total: 0 };

  // --- Loader helpers (JS equivalent of internalLoader.ejs) ---
  function showInternalLoader(container, text) {
    if (!container) return;
    container.setAttribute('data-prev-html', container.innerHTML);
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:4px 8px;">' +
      '<svg style="width:16px;height:16px;animation:resto-spin 0.8s linear infinite;stroke:rgba(107,114,128,1);" viewBox="0 0 256 256">' +
      '<line x1="128" y1="32" x2="128" y2="64" stroke-linecap="round" stroke-width="24"></line>' +
      '<line x1="195.9" y1="60.1" x2="173.3" y2="82.7" stroke-linecap="round" stroke-width="24"></line>' +
      '<line x1="224" y1="128" x2="192" y2="128" stroke-linecap="round" stroke-width="24"></line>' +
      '<line x1="195.9" y1="195.9" x2="173.3" y2="173.3" stroke-linecap="round" stroke-width="24"></line>' +
      '</svg>' +
      '<span style="font-size:12px;font-weight:600;color:rgba(107,114,128,1);">' + (text || 'Loading...') + '</span>' +
      '</div>';
  }

  function hideInternalLoader(container) {
    if (!container) return;
    var prev = container.getAttribute('data-prev-html');
    if (prev) {
      container.innerHTML = prev;
      container.removeAttribute('data-prev-html');
    }
  }

  // Inject spin keyframe if not present
  if (!document.getElementById('resto-spin-style')) {
    var style = document.createElement('style');
    style.id = 'resto-spin-style';
    style.textContent = '@keyframes resto-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  function getItems() {
    return window.RestoCartState.items || [];
  }

  function getQty(itemId) {
    if (itemId === null || itemId === undefined) return 0;
    const item = getItems().find(i => String(i.id) === String(itemId));
    return item ? item.quantity : 0;
  }

  function getBadgeEl() {
    return document.getElementById('navbar-cart-badge') || document.querySelector('a[href="/cart"] span.absolute');
  }

  function getToastEl() {
    return document.getElementById('cart-toast');
  }

  function updateBadge(cartCount) {
    const badge = getBadgeEl();
    if (!badge) return;
    badge.textContent = String(cartCount);
    if (cartCount > 0) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
    // Update cart icon color
    const cartLink = badge.closest('a');
    if (cartLink) {
      const svg = cartLink.querySelector('svg');
      if (svg) {
        if (cartCount > 0) {
          svg.classList.add('text-[#60b246]');
        } else {
          svg.classList.remove('text-[#60b246]');
        }
      }
    }
    // Update bottom nav cart badge
    var bottomBadge = document.getElementById('bottom-cart-badge');
    if (bottomBadge) {
      bottomBadge.textContent = String(cartCount);
      if (cartCount > 0) {
        bottomBadge.classList.remove('hidden');
      } else {
        bottomBadge.classList.add('hidden');
      }
    }
  }

  function updateToast(cartCount) {
    var path = window.location.pathname;
    if (path === '/cart' || path === '/checkout') {
      var existingToast = document.getElementById('cart-toast');
      if (existingToast) existingToast.style.display = 'none';
      return;
    }
    var toast = getToastEl();
    if (!toast) {
  toast = document.createElement('div');
  toast.id = 'cart-toast';
  // Placement: Bottom-Right, Fixed Width, and Rounded Corners
  toast.setAttribute('style', `
    display: none;
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    background: #60b246;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    border-radius: 16px;
    width: auto;
    min-width: 280px;
    max-width: 320px;
  `);

  // Simplified and reduced padding for a "smaller" look
  toast.innerHTML = `
    <div style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
      <div style="flex-shrink: 1; min-width: 0;">
        <div style="font-size: 13px; font-weight: 700; color: white;">
          <span id="cart-toast-count">0</span> item(s)
        </div>
        <div style="font-size: 11px; color: rgba(255,255,255,0.8); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          Ready to checkout?
        </div>
      </div>
      <a id="cart-toast-checkout" href="/checkout" style="
        background: white;
        color: #60b246;
        font-weight: 800;
        padding: 8px 16px;
        border-radius: 10px;
        font-size: 12px;
        white-space: nowrap;
        text-decoration: none;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      ">CHECKOUT</a>
    </div>`;
    
  document.body.appendChild(toast);
}
    var countEl = document.getElementById('cart-toast-count');
    if (countEl) countEl.textContent = String(cartCount);
    toast.style.display = cartCount > 0 ? 'block' : 'none';
  }

  function syncFromResponse(data) {
    if (!data) return;
    window.RestoCartState.items = data.cart || [];
    window.RestoCartState.total = data.totalAmount || 0;
    updateBadge(data.cartCount || 0);
    updateToast(data.cartCount || 0);
    renderAllControls();
  }

  async function apiCall(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.success !== true) return null;
    return data;
  }

  async function add(menuItemId) {
    if (!menuItemId) return;
    var container = document.querySelector('[data-menu-item-id="' + menuItemId + '"]');
    if (container) showInternalLoader(container, 'Adding...');
    try {
      const data = await apiCall('/cart/add', { menuItemId: String(menuItemId) });
      if (data) {
        syncFromResponse(data);
      } else {
        await syncCartFromServer();
      }
    } catch (e) {
      console.error('RestoCart.add failed', e);
      try { await syncCartFromServer(); } catch(e2) {}
    } finally {
      renderAllControls();
    }
  }

  async function remove(menuItemId) {
    var container = document.querySelector('[data-menu-item-id="' + menuItemId + '"]');
    showInternalLoader(container, 'Removing...');
    try {
      const data = await apiCall('/cart/remove', { id: menuItemId });
      if (data) syncFromResponse(data);
    } catch (e) {
      console.error('RestoCart.remove failed', e);
    } finally {
      renderAllControls();
    }
  }

  async function update(menuItemId, quantity) {
    var container = document.querySelector('[data-menu-item-id="' + menuItemId + '"]');
    showInternalLoader(container, 'Updating...');
    try {
      const data = await apiCall('/cart/update', { id: menuItemId, quantity });
      if (data) syncFromResponse(data);
    } catch (e) {
      console.error('RestoCart.update failed', e);
    } finally {
      renderAllControls();
    }
  }

  // Render +/- controls for a single container
  function renderControlItem(container) {
    const itemId = container.getAttribute('data-menu-item-id');
    const qty = getQty(itemId);
    const isUnavailable = container.hasAttribute('data-unavailable');
    const fullWidth = container.hasAttribute('data-full-width');

    // Skip re-render if qty hasn't changed
    var lastQty = container.getAttribute('data-last-qty');
    var lastUnavailable = container.getAttribute('data-last-unavailable');
    if (lastQty !== null && parseInt(lastQty, 10) === qty && lastUnavailable === String(isUnavailable)) return;
    container.setAttribute('data-last-qty', String(qty));
    container.setAttribute('data-last-unavailable', String(isUnavailable));

    if (isUnavailable) {
      container.innerHTML = '<button disabled class="px-3 py-1 text-xs font-bold rounded-lg bg-gray-100 text-gray-400 border border-gray-200">SOLD</button>';
      return;
    }

    if (qty > 0) {
      if (fullWidth) {
        container.innerHTML = `<div class="flex items-center justify-center bg-[#60b246] text-white font-bold text-sm rounded-xl shadow-lg shadow-green-200 overflow-hidden">
          <button type="button" class="w-12 h-12 flex items-center justify-center text-white/70 hover:text-white hover:bg-green-600 focus:outline-none transition-colors text-lg" onclick="RestoCart.update('${itemId}', ${qty - 1})">&#x2212;</button>
          <span class="px-3 text-center text-sm select-none whitespace-nowrap">${qty} in cart</span>
          <button type="button" class="w-12 h-12 flex items-center justify-center text-white hover:bg-green-600 focus:outline-none transition-colors text-lg" onclick="RestoCart.add('${itemId}')">+</button>
          </div>`;
      } else {
        container.innerHTML = `<div class="flex items-center border border-[#d4d5d9] bg-white text-green-600 font-bold text-sm rounded-lg shadow-sm overflow-hidden">
          <button type="button" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-gray-50 focus:outline-none transition-colors" onclick="event.stopPropagation(); RestoCart.update('${itemId}', ${qty - 1})">−</button>
          <span class="w-6 text-center text-xs select-none">${qty}</span>
          <button type="button" class="w-8 h-8 flex items-center justify-center text-green-600 hover:text-green-700 hover:bg-gray-50 focus:outline-none transition-colors" onclick="event.stopPropagation(); RestoCart.add('${itemId}')">+</button>
          </div>`;
      }
    } else {
      if (fullWidth) {
        container.innerHTML = `<button type="button" class="w-full bg-[#60b246] hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl text-sm transition-colors shadow-lg shadow-green-200" onclick="RestoCart.add('${itemId}')">ADD TO CART</button>`;
      } else {
        container.innerHTML = `<button type="button" class="btn-add px-3 py-1 text-xs font-bold rounded-lg" onclick="event.stopPropagation(); RestoCart.add('${itemId}')">ADD<span class="ml-0.5 text-[10px]">+</span></button>`;
      }
    }
  }

  function renderAllControls() {
    document.querySelectorAll('[data-menu-item-id]').forEach(renderControlItem);
  }

  // Expose public API
  window.RestoCart = window.RestoCart || {};
  window.RestoCart.add = add;
  window.RestoCart.remove = remove;
  window.RestoCart.update = update;
  window.RestoCart.getQty = getQty;
  window.RestoCart.renderAll = renderAllControls;
  window.RestoCart.getItems = getItems;
  window.RestoCart.syncFromResponse = syncFromResponse;
  window.RestoCart.showLoader = showInternalLoader;
  window.RestoCart.hideLoader = hideInternalLoader;

  // Sync cart from server (for back-button persistence)
  async function syncCartFromServer() {
    try {
      const res = await fetch('/cart/api/state', {
        headers: { Accept: 'application/json' }
      });
      const data = await res.json();
      if (data) {
        window.RestoCartState.items = data.cart || [];
        window.RestoCartState.total = data.totalAmount || 0;
        var uniqueCount = (data.cart || []).length;
        updateBadge(uniqueCount);
        updateToast(uniqueCount);
        renderAllControls();
      }
    } catch (e) {
      console.error('Cart sync failed', e);
    }
  }

  // Initialize on DOM ready
  function initCart() {
    renderAllControls();
    var uniqueCount = getItems().length;
    updateBadge(uniqueCount);
    updateToast(uniqueCount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCart);
  } else {
    initCart();
  }

  // Re-sync cart on ANY page show (back/forward, refresh, bfcache restore)
  window.addEventListener('pageshow', function () {
    syncCartFromServer();
  });
})();
