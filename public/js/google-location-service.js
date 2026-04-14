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
        
        var deliveryFee = 0;
        if (distKm <= 20) {
          deliveryFee = Math.ceil(distKm / 5) * rate;
        } else {
          // First 20km at base rate (4 units of 5km)
          deliveryFee = 4 * rate;
          // Remaining distance at ₹20 per 5km
          var extraDistance = distKm - 20;
          var extraUnits = Math.ceil(extraDistance / 5);
          deliveryFee += extraUnits * 20;
        }
        
        if (distKm > 0 && deliveryFee < 10) deliveryFee = 10; // Minimum fee
        
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
          // Sync global JS variables for future quantity changes
          if (typeof window.DELIVERY_FEE !== 'undefined') window.DELIVERY_FEE = deliveryFee;
          if (typeof window.GRAND_TOTAL !== 'undefined') window.GRAND_TOTAL = total;
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
    // Tripura bounding box coordinates (approximate)
    var TRIPURA_BOUNDS = {
      minLat: 22.9,
      maxLat: 24.6,
      minLng: 91.1,
      maxLng: 92.3
    };
    
    // Tripura districts and known areas
    var TRIPURA_KEYWORDS = [
      'tripura', 'agartala', 'dhajanagar', 'udaipur', 'kailashahar', 'belonia',
      'ambassa', 'dharamganj', 'jirania', 'bishalgarh', 'ranirbazar', 'teliamura',
      'kamalpur', 'khowai', 'sabroom', 'amarpur', 'belfraph', 'longtharai',
      'sepahijala', 'gomati', 'north tripura', 'south tripura', 'dhalai',
      'unakoti', 'west tripura'
    ];
    
    // Check if coordinates are within Tripura bounding box
    function isInTripuraBounds(lat, lng) {
      return lat >= TRIPURA_BOUNDS.minLat && lat <= TRIPURA_BOUNDS.maxLat &&
             lng >= TRIPURA_BOUNDS.minLng && lng <= TRIPURA_BOUNDS.maxLng;
    }
    
    // Check if any Tripura keyword is in the text
    function containsTripuraKeyword(text) {
      if (!text) return false;
      text = text.toLowerCase();
      return TRIPURA_KEYWORDS.some(function(keyword) {
        return text.indexOf(keyword) !== -1;
      });
    }
    
    var url = NOMINATIM_BASE + '/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=18&addressdetails=1&accept-language=en';
    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.display_name) {
          var addr = data.address || {};
          var displayName = data.display_name;
          var fullAddrLower = displayName.toLowerCase();
          
          // Check if location is in Tripura using multiple methods
          var stateField = addr.state || '';
          var isInTripura = false;
          
          // Method 1: State field contains "tripura"
          if (stateField.toLowerCase().indexOf('tripura') !== -1) {
            isInTripura = true;
          }
          // Method 2: Check if Tripura keyword is in display name
          else if (containsTripuraKeyword(fullAddrLower)) {
            isInTripura = true;
          }
          // Method 3: Check if coordinates are within Tripura bounding box
          else if (isInTripuraBounds(lat, lng)) {
            isInTripura = true;
          }
          // Method 4: Check postcode (Tripura starts with 799)
          var pincode = extractPinCode(addr);
          if (pincode && pincode.toString().startsWith('799')) {
            isInTripura = true;
          }
          
          var parts = [];
          
          // Build address from most specific to least specific
          if (addr.house_number || addr.building) parts.push(addr.house_number || addr.building);
          if (addr.road) parts.push(addr.road);
          if (addr.neighbourhood || addr.suburb) parts.push(addr.neighbourhood || addr.suburb);
          if (addr.locality) parts.push(addr.locality);
          if (addr.village || addr.town || addr.city) parts.push(addr.village || addr.town || addr.city);
          if (addr.district) parts.push(addr.district);
          if (addr.state) parts.push(addr.state);
          
          var shortAddr = parts.join(', ');
          
          // Fallback if we don't have good parts
          if (parts.length < 2) {
            shortAddr = displayName.split(',').slice(0, 4).join(',').trim();
          }
          
          if (pincode && shortAddr.indexOf(pincode) === -1) {
            shortAddr = shortAddr + ' - ' + pincode;
          }
          
          callback({ 
            address: shortAddr, 
            pincode: pincode,
            fullAddress: displayName,
            state: stateField,
            isInTripura: isInTripura
          });
        } else {
          callback(null);
        }
      })
      .catch(function() { callback(null); });
  }

  // ===== Forward Geocoding (Nominatim) - Tripura focused =====
  function forwardGeocode(address, callback) {
    // Helper to find the best Tripura result from an array
    function findTripuraResult(results) {
      if (!results || results.length === 0) return null;
      
      // First, try to find exact Tripura match
      for (var i = 0; i < results.length; i++) {
        var place = results[i];
        var fullAddress = (place.display_name || '').toLowerCase();
        if (fullAddress.indexOf('tripura') !== -1) {
          return place;
        }
      }
      
      // If no exact Tripura match, return first result (bounded search)
      return results[0];
    }
    
    // First try with Tripura viewbox to prioritize local results
    var tripuraQuery = address + ', Tripura';
    var url = NOMINATIM_BASE + '/search?format=json&q=' + encodeURIComponent(tripuraQuery) + '&limit=10&addressdetails=1&countrycodes=in&dedupe=1&viewbox=91.0,24.6,92.5,23.0&bounded=1';
    
    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var result = findTripuraResult(data);
        if (result) {
          var pin = extractPinCode(result.address);
          callback({
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            address: result.display_name,
            pincode: pin,
            isInTripura: (result.display_name || '').toLowerCase().indexOf('tripura') !== -1
          });
        } else {
          // Fallback: try broader search with Tripura context
          var fallbackUrl = NOMINATIM_BASE + '/search?format=json&q=' + encodeURIComponent(tripuraQuery) + '&limit=15&addressdetails=1&countrycodes=in&dedupe=1';
          return fetch(fallbackUrl, { headers: { 'Accept-Language': 'en' } }).then(function(r) { return r.json(); });
        }
      })
      .then(function(data) {
        var result = findTripuraResult(data);
        if (result) {
          var pin = extractPinCode(result.address);
          callback({
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            address: result.display_name,
            pincode: pin,
            isInTripura: (result.display_name || '').toLowerCase().indexOf('tripura') !== -1
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
    dropdown.className = 'fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[999999] max-h-[250px] overflow-y-auto hidden';
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
        // Append Tripura explicitly to search queries and use a bounded viewbox to restrict results to Tripura
        var queryWithContext = query + ', Tripura';
        var url = NOMINATIM_BASE + '/search?format=json&q=' + encodeURIComponent(queryWithContext) + '&limit=10&addressdetails=1&countrycodes=in&dedupe=1&viewbox=91.0,24.6,92.5,23.0&bounded=1';
        fetch(url, { headers: { 'Accept-Language': 'en' } })
          .then(function(r) { return r.json(); })
          .then(function(results) {
            // If no results with bounded viewbox, try a slightly broader search in Tripura
            if (!results || results.length === 0) {
               var fallbackUrl = NOMINATIM_BASE + '/search?format=json&q=' + encodeURIComponent(query + ', Tripura, India') + '&limit=10&addressdetails=1&countrycodes=in&dedupe=1';
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
            
            // Filter results to only show places in Tripura
            var tripuraResults = results.filter(function(place) {
              var fullAddress = (place.display_name || '').toLowerCase();
              return fullAddress.indexOf('tripura') !== -1;
            });
            
            // If no Tripura results, don't show anything
            if (tripuraResults.length === 0) {
              var noResultItem = document.createElement('div');
              noResultItem.className = 'px-3 py-2 text-sm text-gray-500 text-center';
              noResultItem.textContent = 'No locations found in Tripura';
              dropdown.appendChild(noResultItem);
              positionDropdown();
              dropdown.classList.remove('hidden');
              return;
            }
            
            tripuraResults.forEach(function(place) {
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
            callback({ 
              lat: lat, 
              lng: lng, 
              address: result.address, 
              pincode: result.pincode, 
              accuracy: accuracy,
              isInTripura: result.isInTripura
            }, null);
          } else {
            callback({ lat: lat, lng: lng, address: lat.toFixed(4) + ', ' + lng.toFixed(4), pincode: null, accuracy: accuracy, isInTripura: null }, null);
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
    // Skip auto-init if not on storefront pages
    if (window.location.pathname.startsWith('/admin')) {
      return;
    }
    
    fetch('/auth/profile', { credentials: 'same-origin' })
      .then(function(r) { 
        if (!r.ok) {
          // User not authenticated - skip profile check
          checkLocalStorageAndGPS();
          return null;
        }
        return r.json();
      })
      .then(function(user) {
        if (!user) {
          checkLocalStorageAndGPS();
          return;
        }
        
        // 1. Check if user has a location in their profile
        if (user && user.lat && user.lng) {
          window.RestoLocation.update(user.lat, user.lng, buildLabel(user), user.pincode);
          return;
        }

        // 2. Check if user has an address but no coordinates, geocode it (restrict to Tripura)
        if (user && user.address) {
          var tripuraAddress = user.address + ', Tripura';
          forwardGeocode(tripuraAddress, function(result) {
            if (result && result.isInTripura !== false) {
              window.RestoLocation.update(result.lat, result.lng, result.address, result.pincode);
            } else {
              checkAndDetectGPS();
            }
          });
          return;
        }

        // 3. Otherwise, detect GPS
        checkAndDetectGPS();
      })
      .catch(function() {
        checkLocalStorageAndGPS();
      });
  }
  
  function checkLocalStorageAndGPS() {
    // Check localStorage first
    var savedLat = localStorage.getItem('resto_lat');
    var savedLng = localStorage.getItem('resto_lng');
    if (savedLat && savedLng) {
      var addr = localStorage.getItem('resto_address');
      var pin = localStorage.getItem('resto_pincode');
      window.RestoLocation.update(savedLat, savedLng, addr || 'Stored Location', pin);
      return;
    }
    
    // Then check session state
    if (typeof window.RestoCartState !== 'undefined' && window.RestoCartState.lat && window.RestoCartState.lng) {
      console.log('Location already present in state, skipping auto-detect');
      return;
    }
    
    // Finally, detect GPS
    checkAndDetectGPS();
  }

  function checkAndDetectGPS() {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(function(res) {
        if (res.state === 'denied') {
          updateAllFallback();
        } else {
          doDetectGPS();
        }
      });
    } else {
      doDetectGPS();
    }
  }

  function doDetectGPS() {
    detectGPS(function(result, error) {
      if (result) {
        window.RestoLocation.update(result.lat, result.lng, result.address, result.pincode);
      } else {
        updateAllFallback();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
