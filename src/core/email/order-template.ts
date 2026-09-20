import { emailParagraph, escapeHtml as e, storeEmail } from './store-template.js';

type Order = { id: string; currency: string; subtotal: unknown; shippingAmount: unknown; total: unknown; shippingCarrier?: string | null; shippingService?: string | null; items: Array<{ name: string; quantity: number; unitPrice: unknown }> };
const messages: Record<string, [string, string]> = {
  PAID: ['Payment confirmed', 'Thank you for your order. Your payment has been received. We’ll keep you informed as your order is prepared.'],
  PROCESSING: ['Your order is being prepared', 'We’re preparing your provisions. We’ll let you know when your order has shipped.'],
  SHIPPED: ['Your order is on its way', 'Your order has shipped. You can view its latest status in your purchase history.'],
  OUT_FOR_DELIVERY: ['Arriving soon', 'Your order is out for delivery. Please keep your delivery contact number available.'],
  DELIVERED: ['Delivered to your door', 'Your order has been marked as delivered. We hope you enjoy your provisions. Tell us how everything went with a quick review.'],
  CANCELLED: ['Your order has been cancelled', 'This order is now cancelled. Check your purchase history for its details and payment status.'],
  REFUNDED: ['Your order has been refunded', 'Your order is marked as refunded. The time for funds to appear depends on your payment provider.'],
  PAYMENT_PROCESSING: ['Your payment is processing', 'We’re waiting for payment confirmation. This is not yet a payment receipt.'],
  PAYMENT_REVIEW_REQUIRED: ['Your payment needs review', 'Your payment needs to be reviewed before fulfillment. Please do not make another payment for this order.'],
};

export function orderEmailTemplate(input: { appUrl: string; firstName?: string | null; status: string; order: Order; transactionReference?: string }) {
  const { order } = input;
  const [title, intro] = messages[input.status] || ['Your order status', `Your order status is ${input.status.toLowerCase().replaceAll('_', ' ')}.`];
  const money = (value: unknown) => `${order.currency.toUpperCase()} ${Number(value).toFixed(2)}`;
  const delivered = input.status === 'DELIVERED';
  const url = new URL(delivered ? '/review' : '/purchase-history', input.appUrl);
  if (delivered) url.searchParams.set('orderId', order.id);
  const rows = order.items.map(item => `<tr><td style="padding:16px 0;border-bottom:1px solid #E5E5E5;font-size:14px"><strong>${e(item.name)}</strong><br><span style="font-size:12px;color:#737373;line-height:22px">Quantity: ${item.quantity} &middot; ${e(money(item.unitPrice))} each</span></td><td align="right" style="padding:16px 0;border-bottom:1px solid #E5E5E5;font-size:14px;white-space:nowrap">${e(money(Number(item.unitPrice) * item.quantity))}</td></tr>`).join('');
  const totals: Array<[string, unknown]> = [['Subtotal', order.subtotal], ['Shipping', order.shippingAmount], [input.status === 'PAID' ? 'Total paid' : 'Order total', order.total]];
  const shipping = [order.shippingCarrier, order.shippingService].filter(Boolean).join(' — ');
  const text = [intro, ...order.items.map(item => `${item.name} × ${item.quantity} · ${money(item.unitPrice)} each · ${money(Number(item.unitPrice) * item.quantity)}`), ...totals.map(([label, value]) => `${label}: ${money(value)}`), ...(shipping ? [`Shipping service: ${shipping}`] : []), ...(input.transactionReference ? [`Payment reference: ${input.transactionReference}`] : [])].join('\n\n');
  return { subject: `${title} — SAGI`, ...storeEmail({ ...input, title, preview: intro, text, action: { label: delivered ? 'Leave a review' : 'View your order history', url: url.href },
    body: emailParagraph(intro) + `<h2 style="margin:28px 0 0;font:normal 22px Georgia,serif">Your provisions</h2><table width="100%" cellspacing="0" cellpadding="0" aria-label="Order items">${rows}</table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px">${totals.map(([label,value],index) => `<tr><td style="padding:8px 0;font-size:14px;${index===2?'font-weight:bold;border-top:1px solid #E5E5E5':''}">${label}</td><td align="right" style="padding:8px 0;font-size:14px;${index===2?'font-weight:bold;border-top:1px solid #E5E5E5':''}">${e(money(value))}</td></tr>`).join('')}</table>` + (shipping ? emailParagraph(`Shipping service: ${shipping}`) : '') + (input.transactionReference ? emailParagraph(`Payment reference: ${input.transactionReference}`) : ''),
  }) };
}
