const db = require('../../config/db');

const RANGE_LABELS = {
  'all': 'All Time', 'today': 'Today',
  '7d': 'Last 7 Days', '15d': 'Last 15 Days', '21d': 'Last 21 Days', '30d': 'Last 30 Days',
  '3m': 'Last 3 Months', '6m': 'Last 6 Months', '9m': 'Last 9 Months',
  '1y': 'Last 1 Year', '1.5y': 'Last 1.5 Years',
  '2y': 'Last 2 Years', '2.5y': 'Last 2.5 Years', '3y': 'Last 3 Years',
  '3.5y': 'Last 3.5 Years', '4y': 'Last 4 Years', '4.5y': 'Last 4.5 Years', '5y': 'Last 5 Years'
};

function getStartDate(range) {
  if (!range || range === 'all') return new Date(0);
  if (range === 'today') {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }
  const daysMap = {
    '7d': 7, '15d': 15, '21d': 21, '30d': 30,
    '3m': 91, '6m': 182, '9m': 274,
    '1y': 365, '1.5y': 548,
    '2y': 730, '2.5y': 913, '3y': 1095,
    '3.5y': 1278, '4y': 1460, '4.5y': 1643, '5y': 1825
  };
  const days = daysMap[range];
  if (!days) return new Date(0);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function getRevenueData(range) {
  const startDate = getStartDate(range);
  const orders = await db.order.findMany({
    where: { createdAt: { gte: startDate } },
    include: { items: { include: { menuItem: true } } }
  });
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce(
    (sum, o) => sum + (o.status !== 'Cancelled' ? o.totalAmount : 0), 0
  );
  const statusCounts = { Pending: 0, Preparing: 0, Ready: 0, Delivered: 0, Cancelled: 0 };
  orders.forEach(o => { if (statusCounts[o.status] !== undefined) statusCounts[o.status]++; });
  const itemSales = {};
  orders.forEach(o => {
    if (o.status !== 'Cancelled') {
      o.items.forEach(i => {
        itemSales[i.menuItem.name] = (itemSales[i.menuItem.name] || 0) + i.quantity;
      });
    }
  });
  const topItems = Object.entries(itemSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  return { totalOrders, totalRevenue, statusCounts, topItems, rangeLabel: RANGE_LABELS[range] || 'All Time' };
}

async function showDashboard(req, res) {
  try {
    const { tab = 'overview', range = 'all', status = 'All' } = req.query;

    // Today's date boundary
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orderWhereClause = status !== 'All' ? { status } : {};

    // Batched: Run all independent queries in parallel via Promise.all
    const [
      revenueData,
      todayOrders,
      ordersList,
      menuItems,
      categories,
      offers,
      settingsRows,
      pendingRefundCount
    ] = await Promise.all([
      getRevenueData(range),
      // Optimized: only select fields needed for aggregation (no items.menuItem join)
      db.order.findMany({
        where: { createdAt: { gte: today } },
        select: { status: true, totalAmount: true }
      }),
      db.order.findMany({
        where: orderWhereClause,
        include: { user: true, items: { include: { menuItem: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      db.menuItem.findMany({
        include: { category: true },
        orderBy: { createdAt: 'desc' }
      }),
      db.category.findMany({
        include: { _count: { select: { menuItems: true } } }
      }),
      db.offer.findMany({
        orderBy: { createdAt: 'desc' }
      }),
      db.setting.findMany(),
      // Count pending refunds for admin banner
      db.order.count({
        where: {
          status: 'Cancelled',
          paymentMethod: 'Online',
          paymentStatus: 'Paid',
          refundStatus: { not: 'Completed' }
        }
      })
    ]);

    // Aggregate today's stats from lightweight query results
    const todayRevenue = todayOrders.reduce(
      (sum, o) => sum + (o.status !== 'Cancelled' ? o.totalAmount : 0), 0
    );
    const pendingCount = todayOrders.filter(o => o.status === 'Pending').length;

    const settings = {};
    settingsRows.forEach(s => { settings[s.key] = s.value; });

    res.render('admin/dashboard', {
      title: 'Lazeez Admin Dashboard',
      layout: 'layouts/admin',
      activeTab: tab,
      range,
      rangeLabel: revenueData.rangeLabel,
      totalOrders: revenueData.totalOrders,
      totalRevenue: revenueData.totalRevenue,
      statusCounts: revenueData.statusCounts,
      topItems: revenueData.topItems,
      todayOrders: todayOrders.length,
      todayRevenue,
      pendingCount,
      orders: ordersList,
      currentStatus: status,
      items: menuItems,
      categories,
      offers,
      deliveryRatePer5km: parseFloat(settings.deliveryRatePer5km || '10'),
      platformFee: parseFloat(settings.platformFee || '5'),
      pendingRefundCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading dashboard');
  }
}

async function apiRevenue(req, res) {
  try {
    const { range = 'all' } = req.query;
    const data = await getRevenueData(range);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
}

async function apiOrders(req, res) {
  try {
    const { status = 'All' } = req.query;
    const whereClause = status !== 'All' ? { status } : {};
    const orders = await db.order.findMany({
      where: whereClause,
      include: { user: true, items: { include: { menuItem: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const statusColors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Preparing': 'bg-blue-100 text-blue-800',
      'Ready': 'bg-indigo-100 text-indigo-800',
      'Delivered': 'bg-green-100 text-green-800',
      'Cancelled': 'bg-red-100 text-red-800'
    };

    const html = orders.length === 0
      ? '<tr><td colspan="7" class="px-6 py-10 text-center text-sm text-gray-500">No orders found.</td></tr>'
      : orders.map(order => {
          const date = new Date(order.createdAt).toLocaleString();
          const color = statusColors[order.status] || 'bg-gray-100 text-gray-800';
          return `<tr class="hover:bg-gray-50 cursor-pointer" data-order-id="${order.id}" onclick="window.location.href='/admin/orders/${order.id}'">
            <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-bold text-gray-900">#${order.id}</td>
            <td class="hidden sm:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">${date}</td>
            <td class="hidden md:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900">${order.user?.name || order.user?.email || 'Guest'}</td>
            <td class="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">${order.dineIn ? 'Dine-in' : 'Delivery'}</td>
            <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-gray-900">₹${order.totalAmount.toFixed(2)}</td>
            <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full status-badge ${color}">${order.status}</span></td>
            <td class="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium"><a href="/admin/orders/${order.id}" class="text-indigo-600 hover:text-indigo-900">&rarr;</a></td>
          </tr>`;
        }).join('');

    res.json({ html, count: orders.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ html: '', count: 0 });
  }
}

module.exports = { showDashboard, apiRevenue, apiOrders };
