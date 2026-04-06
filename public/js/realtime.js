/**
 * Real-time client using Server-Sent Events (SSE)
 * Automatically reconnects and dispatches events.
 */
(function() {
  var evtSource = null;
  var reconnectTimer = null;
  var listeners = {};
  var failCount = 0;

  function connect() {
    if (evtSource) {
      evtSource.close();
    }

    evtSource = new EventSource('/events');

    evtSource.addEventListener('connected', function() {
      // Connected successfully — reset fail count
      failCount = 0;
    });

    evtSource.addEventListener('order:new', function(e) {
      try {
        var data = JSON.parse(e.data);
        fire('order:new', data);
      } catch (err) {}
    });

    evtSource.addEventListener('order:status', function(e) {
      try {
        var data = JSON.parse(e.data);
        fire('order:status', data);
      } catch (err) {}
    });

    evtSource.addEventListener('order:cancel', function(e) {
      try {
        var data = JSON.parse(e.data);
        fire('order:cancel', data);
      } catch (err) {}
    });

    evtSource.addEventListener('offer:new', function(e) {
      try {
        var data = JSON.parse(e.data);
        fire('offer:new', data);
      } catch (err) {}
    });

    evtSource.onerror = function() {
      evtSource.close();
      failCount++;
      // Stop reconnecting after 2 failures (likely unauthenticated or server down)
      if (failCount > 2) return;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 3000);
    };
  }

  function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  }

  function fire(event, data) {
    if (listeners[event]) {
      listeners[event].forEach(function(cb) { cb(data); });
    }
  }

  // Expose globally
  window.RestoRealtime = {
    on: on,
    connect: connect
  };

  // Auto-connect
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
