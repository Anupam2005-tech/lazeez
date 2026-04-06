(function () {
  var RESTAURANT_LAT = window.RESTAURANT_LAT || 23.5492425;
  var RESTAURANT_LNG = window.RESTAURANT_LNG || 91.4668604;
  var AVG_SPEED_KMH = 25;
  var PREP_TIME_MIN = 30;
  var FALLBACK_DISTANCE_KM = 2.5;
  var FALLBACK_TIME_MIN = 25;
  var FALLBACK_TOTAL_MIN = 55;
  var NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

  // ===== Utility Functions =====
  function formatDistance(km) {
    if (km < 1) return Math.round(km * 1000) + ' m';
    return km.toFixed(1) + ' km';
  }

  function formatTime(totalMin) {
    if (totalMin > 60) {
      var hours = totalMin / 60;
      if (Number.isInteger(hours)) return hours + ' hour' + (hours > 1 ? 's' : '');
      return hours.toFixed(1) + ' hours';
    }
    return totalMin + ' min' + (totalMin !== 1 ? 's' : '');
  }

  function formatTimeRange(totalMin) {
    if (totalMin > 60) {
      var hours = totalMin / 60;
      var formatted = Number.isInteger(hours) ? hours.toString() : hours.toFixed(1);
      return formatted + ' hour' + (parseFloat(formatted) !== 1 ? 's' : '');
    }
    var low = Math.max(30, totalMin - 5);
    var high = totalMin + 5;
    return low + '-' + high + ' mins';
  }

  function toRad(deg) { return deg * Math.PI / 180; }

  function haversineDistance(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function calculateDistance(lat, lng) {
    return haversineDistance(lat, lng, RESTAURANT_LAT, RESTAURANT_LNG);
  }

  function updateElement(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function updateAllFallback() {
    var distStr = formatDistance(FALLBACK_DISTANCE_KM);
    var timeStr = formatTimeRange(FALLBACK_TIME_MIN);
    var totalStr = formatTimeRange(FALLBACK_TOTAL_MIN);
    updateElement('menu-distance', distStr);
    updateElement('menu-time', timeStr);
    updateElement('item-time', timeStr);
    updateElement('cart-distance', distStr);
    updateElement('cart-delivery-time', totalStr);
    updateElement('navbar-location', 'Set your location');
  }

  function updateCheckoutDeliveryFee(distKm) {
    fetch('/api/settings')
      .then(function(r) { return r.json(); })
      .then(function(s) {
        var rate = s.deliveryRatePer5km || 10;
        var platform = s.platformFee || 5;
        var fiveKmBlocks = Math.ceil(distKm / 5);
        var deliveryFee = fiveKmBlocks * rate;
        var feeEl = document.getElementById('checkout-delivery-fee');
        var toPayEl = document.getElementById('checkout-to-pay');
        var payBtn = document.getElementById('checkout-pay-btn');
        var itemTotalEl = document.getElementById('checkout-item-total');
        var distEl = document.getElementById('checkout-distance');
        if (feeEl) feeEl.textContent = '\u20B9' + deliveryFee.toFixed(2);
        if (distEl) distEl.textContent = distKm.toFixed(1) + ' km';
        if (itemTotalEl) {
          var itemTotal = parseFloat(itemTotalEl.textContent.replace(/[^\d.]/g, '')) || 0;
          var total = itemTotal + deliveryFee + platform;
          if (toPayEl) toPayEl.textContent = '\u20B9' + total.toFixed(2);
          if (payBtn) payBtn.textContent = 'PAY \u20B9' + total.toFixed(2) + ' SECURELY';
        }
      })
      .catch(function() {});
  }

  // ===== Extract pin code from Nominatim address =====
  function extractPinCode(addressObj) {
    if (!addressObj) return null;
    return addressObj.postcode || null;
  }

  // ===== Reverse Geocoding (Nominatim) =====
  function reverseGeocode(lat, lng, callback) {
    var url = NOMINATIM_BASE + '/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=18&addressdetails=1';
    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.display_name) {
          var addr = data.address || {};
          var parts = [];
          if (addr.road) parts.push(addr.road);
          if (addr.suburb) parts.push(addr.suburb);
          if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
          var shortAddr = parts.join(', ') || data.display_name.split(',').slice(0, 3).join(',').trim();
          var pin = extractPinCode(addr);
          if (pin && shortAddr.indexOf(pin) === -1) {
            shortAddr = shortAddr + ' - ' + pin;
          }
          callback({ address: shortAddr, pincode: pin });
        } else {
          callback(null);
        }
      })
      .catch(function() { callback(null); });
  }

  // ===== Forward Geocoding (Nominatim) =====
  function forwardGeocode(address, callback) {
    var url = NOMINATIM_BASE + '/search?format=json&q=' + encodeURIComponent(address) + '&limit=10&addressdetails=1&countrycodes=in&dedupe=1';
    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.length > 0) {
          var result = data[0];
          var pin = extractPinCode(result.address);
          callback({
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            address: result.display_name,
            pincode: pin
          });
        } else {
          callback(null);
        }
      })
      .catch(function() { callback(null); });
  }

  // ===== Nominatim Search (Autocomplete replacement) =====
  var searchTimeout = null;
  function initPlacesAutocomplete(inputElement, onPlaceSelected) {
    if (!inputElement) return null;

    // Create dropdown container appended to body to avoid overflow clipping
    var dropdown = document.createElement('div');
    dropdown.className = 'fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] max-h-[250px] overflow-y-auto hidden';
    document.body.appendChild(dropdown);

    function positionDropdown() {
      var rect = inputElement.getBoundingClientRect();
      dropdown.style.top = (rect.bottom + 4) + 'px';
      dropdown.style.left = rect.left + 'px';
      dropdown.style.width = rect.width + 'px';
    }

    inputElement.addEventListener('input', function() {
      var query = inputElement.value.trim();
      if (searchTimeout) clearTimeout(searchTimeout);
      if (query.length < 3) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        return;
      }
      searchTimeout = setTimeout(function() {
        positionDropdown();
        // Use viewbox to prioritize results near the restaurant area (Tripura)
        var viewbox = '90.5,24.5,92.5,22.5';
        var url = NOMINATIM_BASE + '/search?format=json&q=' + encodeURIComponent(query) + '&limit=10&addressdetails=1&countrycodes=in&dedupe=1&viewbox=' + viewbox + '&bounded=0';
        fetch(url, { headers: { 'Accept-Language': 'en' } })
          .then(function(r) { return r.json(); })
          .then(function(results) {
            // If no results, try appending local context
            if (!results || results.length === 0) {
              var fallbackUrl = NOMINATIM_BASE + '/search?format=json&q=' + encodeURIComponent(query + ', Udaipur, Tripura') + '&limit=10&addressdetails=1&countrycodes=in&dedupe=1';
              return fetch(fallbackUrl, { headers: { 'Accept-Language': 'en' } }).then(function(r) { return r.json(); });
            }
            return results;
          })
          .then(function(results) {
            dropdown.innerHTML = '';
            if (!results || results.length === 0) {
              dropdown.classList.add('hidden');
              return;
            }
            results.forEach(function(place) {
              var item = document.createElement('div');
              item.className = 'px-3 py-2 cursor-pointer hover:bg-orange-50 text-sm border-b border-gray-100 last:border-0';
              item.innerHTML = '<p class="font-medium text-gray-800 truncate">' + (place.display_name.split(',')[0]) + '</p>' +
                '<p class="text-xs text-gray-500 truncate">' + place.display_name + '</p>';
              item.addEventListener('click', function() {
                var pin = extractPinCode(place.address);
                onPlaceSelected({
                  lat: parseFloat(place.lat),
                  lng: parseFloat(place.lon),
                  address: place.display_name,
                  pincode: pin
                });
                dropdown.classList.add('hidden');
                dropdown.innerHTML = '';
                inputElement.value = place.display_name.split(',').slice(0, 3).join(',').trim();
              });
              dropdown.appendChild(item);
            });
            positionDropdown();
            dropdown.classList.remove('hidden');
          })
          .catch(function() { dropdown.classList.add('hidden'); });
      }, 400);
    });

    // Reposition on scroll/resize
    function repositionHandler() {
      if (!dropdown.classList.contains('hidden')) {
        positionDropdown();
      }
    }
    window.addEventListener('scroll', repositionHandler, true);
    window.addEventListener('resize', repositionHandler);

    // Close dropdown on outside click
    document.addEventListener('click', function(e) {
      if (!inputElement.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });

    return { input: inputElement };
  }

  // ===== GPS Detection =====
  function detectGPS(callback) {
    if (!navigator.geolocation) {
      callback(null, 'Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function(position) {
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;
        var accuracy = position.coords.accuracy;
        reverseGeocode(lat, lng, function(result) {
          if (result) {
            callback({ lat: lat, lng: lng, address: result.address, pincode: result.pincode, accuracy: accuracy }, null);
          } else {
            callback({ lat: lat, lng: lng, address: lat.toFixed(4) + ', ' + lng.toFixed(4), pincode: null, accuracy: accuracy }, null);
          }
        });
      },
      function(error) {
        var msg = 'Location detection failed';
        if (error.code === 1) msg = 'Location permission denied';
        if (error.code === 2) msg = 'Location unavailable';
        if (error.code === 3) msg = 'Location request timed out';
        callback(null, msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // ===== Build label from saved profile components =====
  function buildLabel(user) {
    var parts = [];
    if (user.flatNo) parts.push(user.flatNo);
    if (user.address) parts.push(user.address);
    if (user.landmark) parts.push(user.landmark);
    var label = parts.join(', ');
    if (user.pincode && label.indexOf(user.pincode) === -1) {
      label = label + ' - ' + user.pincode;
    }
    return label || 'Saved Location';
  }

  // ===== Global RestoLocation API =====
  window.RestoLocation = {
    update: function(lat, lng, address, pincode) {
      var distKm = calculateDistance(lat, lng);
      var travelMin = Math.ceil((distKm / AVG_SPEED_KMH) * 60);
      var totalMin = PREP_TIME_MIN + travelMin;
      var distStr = formatDistance(distKm);
      var timeStr = formatTime(travelMin);
      var totalStr = formatTime(totalMin);

      var navLoc = document.getElementById('navbar-location');
      if (navLoc && address) navLoc.textContent = address;

      ['menu-distance', 'cart-distance'].forEach(function(id) {
        var e = document.getElementById(id); if (e) e.textContent = distStr;
      });
      ['menu-time', 'item-time'].forEach(function(id) {
        var e = document.getElementById(id); if (e) e.textContent = timeStr;
      });
      ['cart-delivery-time', 'checkout-delivery-time'].forEach(function(id) {
        var e = document.getElementById(id); if (e) e.textContent = totalStr;
      });

      if (document.getElementById('checkout-delivery-fee')) {
        updateCheckoutDeliveryFee(distKm);
      }

      // Save lat/lng, pincode AND address to profile
      var body = { lat: lat, lng: lng };
      if (pincode) body.pincode = pincode;
      if (address) body.address = address;
      fetch('/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).catch(function() {});

      // Also save as a saved address if user is logged in
      if (address && address !== 'Your Location') {
        fetch('/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: 'GPS Location',
            address: address,
            pincode: pincode || null,
            lat: lat,
            lng: lng,
            isDefault: true
          })
        }).catch(function() {});
      }
    },

    detectGPS: detectGPS,
    reverseGeocode: reverseGeocode,
    forwardGeocode: forwardGeocode,
    initPlacesAutocomplete: initPlacesAutocomplete,
    buildLabel: buildLabel
  };

  // ===== Leaflet Map Helper =====
  window.RestoMap = {
    init: function(containerId, options) {
      if (typeof L === 'undefined') return null;
      options = options || {};
      var container = document.getElementById(containerId);
      if (!container) return null;

      var lat = options.lat || RESTAURANT_LAT;
      var lng = options.lng || RESTAURANT_LNG;
      var zoom = options.zoom || 14;

      var map = L.map(containerId).setView([lat, lng], zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      return {
        map: map,
        addMarker: function(lat, lng, title, color) {
          var icon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:' + (color || '#fc8019') + ';width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });
          var marker = L.marker([lat, lng], { icon: icon, title: title || '' }).addTo(map);
          if (title) marker.bindPopup(title);
          return marker;
        },
        addPolyline: function(lat1, lng1, lat2, lng2) {
          return L.polyline([[lat1, lng1], [lat2, lng2]], {
            color: '#fc8019',
            weight: 3,
            opacity: 0.8
          }).addTo(map);
        },
        fitBounds: function(lat1, lng1, lat2, lng2) {
          map.fitBounds([[lat1, lng1], [lat2, lng2]], { padding: [30, 30] });
        }
      };
    }
  };

  // ===== Auto-initialize on page load =====
  function init() {
    fetch('/auth/profile', { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(user) {
        if (user && user.lat && user.lng) {
          var label = buildLabel(user);
          var navLoc = document.getElementById('navbar-location');
          if (navLoc) navLoc.textContent = label;
          var distKm = calculateDistance(user.lat, user.lng);
          var travelMin = Math.ceil((distKm / AVG_SPEED_KMH) * 60);
          var totalMin = PREP_TIME_MIN + travelMin;
          ['menu-distance', 'cart-distance'].forEach(function(id) {
            var e = document.getElementById(id); if (e) e.textContent = formatDistance(distKm);
          });
          ['menu-time', 'item-time'].forEach(function(id) {
            var e = document.getElementById(id); if (e) e.textContent = formatTime(travelMin);
          });
          ['cart-delivery-time', 'checkout-delivery-time'].forEach(function(id) {
            var e = document.getElementById(id); if (e) e.textContent = formatTime(totalMin);
          });
          if (document.getElementById('checkout-delivery-fee')) {
            updateCheckoutDeliveryFee(distKm);
          }
        } else {
          detectGPS(function(result, error) {
            if (result) {
              window.RestoLocation.update(result.lat, result.lng, result.address, result.pincode);
            } else {
              updateAllFallback();
            }
          });
        }
      })
      .catch(function() {
        detectGPS(function(result, error) {
          if (result) {
            window.RestoLocation.update(result.lat, result.lng, result.address, result.pincode);
          } else {
            updateAllFallback();
          }
        });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
