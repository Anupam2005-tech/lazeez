/**
 * Location Service - fallback wrapper.
 * The primary location service is /js/google-location-service.js (now Leaflet-based).
 * This file exists for backward compatibility.
 */
(function () {
  // If the main location service has already initialized RestoLocation, do nothing
  if (window.RestoLocation) return;

  var RESTAURANT_LAT = window.RESTAURANT_LAT || 23.5492425;
  var RESTAURANT_LNG = window.RESTAURANT_LNG || 91.4668604;
  var AVG_SPEED_KMH = 25;
  var PREP_TIME_MIN = 30;

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
  function formatDistance(km) {
    if (km < 1) return Math.round(km * 1000) + ' m';
    return km.toFixed(1) + ' km';
  }
  function formatTime(totalMin) {
    if (totalMin > 60) { var h = totalMin / 60; return (Number.isInteger(h) ? h : h.toFixed(1)) + ' hour' + (h !== 1 ? 's' : ''); }
    return totalMin + ' min' + (totalMin !== 1 ? 's' : '');
  }
  function updateElement(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; }

  window.RestoLocation = {
    update: function(lat, lng, address, pincode) {
      var distKm = haversineDistance(lat, lng, RESTAURANT_LAT, RESTAURANT_LNG);
      var travelMin = Math.ceil((distKm / AVG_SPEED_KMH) * 60);
      var totalMin = PREP_TIME_MIN + travelMin;
      updateElement('navbar-location', address || 'Your Location');
      ['menu-distance', 'cart-distance'].forEach(function(id) { updateElement(id, formatDistance(distKm)); });
      ['menu-time', 'item-time'].forEach(function(id) { updateElement(id, formatTime(travelMin)); });
      ['cart-delivery-time', 'checkout-delivery-time'].forEach(function(id) { updateElement(id, formatTime(totalMin)); });
      var body = { lat: lat, lng: lng };
      if (pincode) body.pincode = pincode;
      if (address) body.address = address;
      fetch('/auth/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(function() {});

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
    detectGPS: function(callback) {
      if (!navigator.geolocation) { callback(null, 'Geolocation not supported'); return; }
      navigator.geolocation.getCurrentPosition(
        function(pos) { callback({ lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Your Location', pincode: null }, null); },
        function(err) { callback(null, 'Location detection failed'); },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    },
    initPlacesAutocomplete: function() { return null; },
    buildLabel: function(user) {
      var parts = [];
      if (user.flatNo) parts.push(user.flatNo);
      if (user.address) parts.push(user.address);
      if (user.landmark) parts.push(user.landmark);
      var label = parts.join(', ');
      if (user.pincode && label.indexOf(user.pincode) === -1) label += ' - ' + user.pincode;
      return label || 'Saved Location';
    }
  };

  fetch('/auth/profile', { credentials: 'same-origin' })
    .then(function(r) { return r.json(); })
    .then(function(user) {
      if (user && user.lat && user.lng) {
        window.RestoLocation.update(user.lat, user.lng, window.RestoLocation.buildLabel(user), user.pincode);
      } else {
        updateElement('navbar-location', 'Set your location');
      }
    })
    .catch(function() { updateElement('navbar-location', 'Set your location'); });
})();
