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

async function showReports(req, res) {
  try {
    const { range } = req.query;
    const startDate = getStartDate(range);

    const orders = await db.order.findMany({
      where: { createdAt: { gte: startDate } },
      include: { items: { include: { menuItem: true } } }
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (sum, order) => sum + (order.status !== 'Cancelled' ? order.totalAmount : 0), 0
    );

    const statusCounts = { Pending: 0, Preparing: 0, Ready: 0, Delivered: 0, Cancelled: 0 };
    orders.forEach(o => {
      if (statusCounts[o.status] !== undefined) statusCounts[o.status]++;
    });

    const itemSales = {};
    orders.forEach(o => {
      if (o.status !== 'Cancelled') {
        o.items.forEach(i => {
          if (!itemSales[i.menuItem.name]) itemSales[i.menuItem.name] = 0;
          itemSales[i.menuItem.name] += i.quantity;
        });
      }
    });

    const topItems = Object.entries(itemSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    res.render('admin/reports/index', {
      title: 'Reporting Dashboard',
      layout: 'layouts/admin',
      range: range || 'all',
      rangeLabel: RANGE_LABELS[range] || 'All Time',
      totalOrders,
      totalRevenue,
      statusCounts,
      topItems
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading reports');
  }
}

module.exports = { showReports };
