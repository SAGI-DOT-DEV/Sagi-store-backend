import type { Prisma } from '@prisma/client';

// Run inside the successful-payment transaction, after claiming the payment.
// Do not clear the whole cart: it may contain additions made after checkout.
export async function removePurchasedQuantities(
 tx: Prisma.TransactionClient,
 userId: string,
 purchased: { variantId: string; quantity: number }[],
) {
 const cart = await tx.cart.findUnique({ where: { userId }, include: { items: true } });
 if (!cart) return;
 const quantities = new Map<string, number>();
 for (const item of purchased) quantities.set(item.variantId, (quantities.get(item.variantId) || 0) + item.quantity);
 for (const item of cart.items) {
  const quantity = quantities.get(item.variantId);
  if (!quantity) continue;
  if (item.quantity <= quantity) await tx.cartItem.delete({ where: { id: item.id } });
  else await tx.cartItem.update({ where: { id: item.id }, data: { quantity: { decrement: quantity } } });
 }
}
