import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { removePurchasedQuantities } from './purchased-cart.service.js';

function transaction(items: { id: string; variantId: string; quantity: number }[] | null) {
 const mocks = { cart: { findUnique: vi.fn().mockResolvedValue(items ? { items } : null) }, cartItem: { delete: vi.fn(), update: vi.fn() } };
 return { mocks, tx: mocks as unknown as Prisma.TransactionClient };
}

describe('paid order cart reconciliation', () => {
 it('removes purchased lines but preserves unrelated products', async () => {
  const { tx, mocks } = transaction([{ id: 'a', variantId: 'paid', quantity: 2 }, { id: 'b', variantId: 'other', quantity: 4 }]);
  await removePurchasedQuantities(tx, 'user', [{ variantId: 'paid', quantity: 2 }]);
  expect(mocks.cartItem.delete).toHaveBeenCalledExactlyOnceWith({ where: { id: 'a' } });
  expect(mocks.cartItem.update).not.toHaveBeenCalled();
 });
 it('preserves extra quantities added after checkout', async () => {
  const { tx, mocks } = transaction([{ id: 'a', variantId: 'paid', quantity: 5 }]);
  await removePurchasedQuantities(tx, 'user', [{ variantId: 'paid', quantity: 2 }]);
  expect(mocks.cartItem.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 'a' }, data: { quantity: { decrement: 2 } } });
  expect(mocks.cartItem.delete).not.toHaveBeenCalled();
 });
 it('never makes reduced quantities negative', async () => {
  const { tx, mocks } = transaction([{ id: 'a', variantId: 'paid', quantity: 1 }]);
  await removePurchasedQuantities(tx, 'user', [{ variantId: 'paid', quantity: 3 }]);
  expect(mocks.cartItem.delete).toHaveBeenCalledOnce();
  expect(mocks.cartItem.update).not.toHaveBeenCalled();
 });
 it('does not recreate removed cart items', async () => {
  const { tx, mocks } = transaction([]);
  await removePurchasedQuantities(tx, 'user', [{ variantId: 'paid', quantity: 3 }]);
  expect(mocks.cartItem.delete).not.toHaveBeenCalled();
  expect(mocks.cartItem.update).not.toHaveBeenCalled();
 });
});
