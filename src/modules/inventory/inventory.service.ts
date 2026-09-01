import { InventoryType, Prisma } from '@prisma/client';
import { InventoryError, NotFoundError } from '../../core/errors/app-error.js';

type InventoryRow = { id:string; quantity:number; reservedQuantity:number };

/** Reserves stock in the same statement that verifies availability. */
export async function reserveInventory(tx:Prisma.TransactionClient,variantId:string,quantity:number){
 const rows=await tx.$queryRaw<InventoryRow[]>`
  UPDATE "Inventory"
  SET "reservedQuantity" = "reservedQuantity" + ${quantity}
  WHERE "variantId" = ${variantId}
   AND "quantity" - "reservedQuantity" >= ${quantity}
  RETURNING id, quantity, "reservedQuantity"
 `;
 if(!rows[0])throw new InventoryError('Insufficient inventory');
 return rows[0];
}

/** Moves an existing reservation to sold stock without a read-then-write gap. */
export async function sellReservedInventory(tx:Prisma.TransactionClient,input:{variantId:string;quantity:number;orderId:string;transactionReference:string}){
 const rows=await tx.$queryRaw<InventoryRow[]>`
  UPDATE "Inventory"
  SET quantity = quantity - ${input.quantity},
      "reservedQuantity" = "reservedQuantity" - ${input.quantity}
  WHERE "variantId" = ${input.variantId}
   AND quantity >= ${input.quantity}
   AND "reservedQuantity" >= ${input.quantity}
  RETURNING id, quantity, "reservedQuantity"
 `;
 const inventory=rows[0];
 if(!inventory)throw new InventoryError('Inventory reservation is no longer available');
 await tx.inventoryTransaction.create({data:{inventoryId:inventory.id,orderId:input.orderId,type:'SOLD',previousQuantity:inventory.quantity+input.quantity,quantityChanged:-input.quantity,newQuantity:inventory.quantity,reason:'Stripe payment confirmed',transactionReference:input.transactionReference}});
 return inventory;
}

/** Releases an abandoned Checkout reservation without changing physical stock. */
export async function releaseReservedInventory(tx:Prisma.TransactionClient,input:{variantId:string;quantity:number;orderId:string;transactionReference:string}){
 const rows=await tx.$queryRaw<InventoryRow[]>`
  UPDATE "Inventory"
  SET "reservedQuantity" = "reservedQuantity" - ${input.quantity}
  WHERE "variantId" = ${input.variantId}
   AND "reservedQuantity" >= ${input.quantity}
  RETURNING id, quantity, "reservedQuantity"
 `;
 const inventory=rows[0];
 if(!inventory)throw new InventoryError('Inventory reservation is no longer available');
 await tx.inventoryTransaction.create({data:{inventoryId:inventory.id,orderId:input.orderId,type:'RELEASED',previousQuantity:inventory.quantity,quantityChanged:0,newQuantity:inventory.quantity,reason:'Stripe Checkout session expired',transactionReference:input.transactionReference}});
 return inventory;
}

export async function changeInventory(tx:Prisma.TransactionClient,input:{variantId:string;change:number;type:InventoryType;reason:string;actorId?:string;orderId?:string;transactionReference?:string}){
 const rows=await tx.$queryRaw<InventoryRow[]>`
  UPDATE "Inventory"
  SET quantity = quantity + ${input.change}
  WHERE "variantId" = ${input.variantId}
   AND quantity + ${input.change} >= "reservedQuantity"
   AND quantity + ${input.change} >= 0
  RETURNING id, quantity, "reservedQuantity"
 `;
 const updated=rows[0];
 if(!updated){
  if(!await tx.inventory.findUnique({where:{variantId:input.variantId},select:{id:true}}))throw new NotFoundError('Inventory record not found');
  throw new InventoryError();
 }
 await tx.inventoryTransaction.create({data:{inventoryId:updated.id,orderId:input.orderId,actorId:input.actorId,type:input.type,previousQuantity:updated.quantity-input.change,quantityChanged:input.change,newQuantity:updated.quantity,reason:input.reason,transactionReference:input.transactionReference}});
 return updated;
}
