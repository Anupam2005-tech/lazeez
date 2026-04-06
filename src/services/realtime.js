/**
 * Real-time service using Server-Sent Events (SSE)
 * Manages connections and broadcasts events to admin and user clients.
 */

// Store active SSE connections
const clients = {
  admin: new Set(),    // admin dashboard connections
  users: new Map()     // userId -> Set of connections
};

function addAdminClient(res) {
  clients.admin.add(res);
  res.on('close', () => clients.admin.delete(res));
}

function addUserClient(userId, res) {
  if (!clients.users.has(userId)) {
    clients.users.set(userId, new Set());
  }
  clients.users.get(userId).add(res);
  res.on('close', () => {
    const set = clients.users.get(userId);
    if (set) {
      set.delete(res);
      if (set.size === 0) clients.users.delete(userId);
    }
  });
}

function sendToClient(res, event, data) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch (e) {
    // Client disconnected
  }
}

// Broadcast to all admins
function broadcastToAdmins(event, data) {
  clients.admin.forEach(res => sendToClient(res, event, data));
}

// Broadcast to a specific user
function broadcastToUser(userId, event, data) {
  const set = clients.users.get(userId);
  if (set) {
    set.forEach(res => sendToClient(res, event, data));
  }
}

// Broadcast to everyone (admin + specific user)
function broadcastOrderEvent(event, data) {
  broadcastToAdmins(event, data);
  if (data.userId) {
    broadcastToUser(data.userId, event, data);
  }
}

// 'order:new'      - new order placed
// 'order:status'   - order status updated
// 'order:cancel'   - order cancelled (by user or admin)
// 'offer:new'      - new marketing offer created

function broadcastToAll(event, data) {
  // Broadcast to all admins
  clients.admin.forEach(res => sendToClient(res, event, data));
  // Broadcast to all users
  clients.users.forEach(set => {
    set.forEach(res => sendToClient(res, event, data));
  });
}

module.exports = {
  addAdminClient,
  addUserClient,
  broadcastToAdmins,
  broadcastToUser,
  broadcastOrderEvent,
  broadcastToAll
};
