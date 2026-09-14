type SalesOrder = {
  total: unknown;
  createdAt: Date;
  items: { quantity: number }[];
};

export function summarizeSales(orders: SalesOrder[]) {
  let revenueCents = 0;
  let unitsSold = 0;
  const months = new Map<string, { cents: number; orders: number }>();
  for (const order of orders) {
    const cents = Math.round(Number(order.total) * 100);
    revenueCents += cents;
    unitsSold += order.items.reduce((sum, item) => sum + item.quantity, 0);
    const month = order.createdAt.toISOString().slice(0, 7);
    const bucket = months.get(month) ?? { cents: 0, orders: 0 };
    bucket.cents += cents;
    bucket.orders += 1;
    months.set(month, bucket);
  }
  return {
    revenue: revenueCents / 100,
    orders: orders.length,
    averageOrderValue: orders.length ? Math.round(revenueCents / orders.length) / 100 : 0,
    unitsSold,
    series: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, bucket]) => ({
      month, revenue: bucket.cents / 100, orders: bucket.orders,
    })),
  };
}
