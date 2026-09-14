import { prisma } from '../../database/prisma.js';
import { InventoryError,NotFoundError } from '../../core/errors/app-error.js';

const cartDetails={items:{include:{variant:{include:{product:{include:{images:{orderBy:{position:'asc' as const}}}},inventory:true}}},orderBy:{variantId:'asc' as const}}};

export class CartService {
 private async cart(userId:string){return prisma.cart.upsert({where:{userId},create:{userId},update:{},include:cartDetails});}

 private async assertAvailable(variantId:string,quantity:number){const variant=await prisma.productVariant.findUnique({where:{id:variantId},include:{product:true,inventory:true}});if(!variant)throw new NotFoundError('Product variant not found');const available=variant.inventory?variant.inventory.quantity-variant.inventory.reservedQuantity:0;if(variant.product.status!=='ACTIVE'||available<quantity)throw new InventoryError(`Only ${Math.max(available,0)} of ${variant.sku} are available`);}

 async get(userId:string){return this.cart(userId);}

 async addItem(userId:string,variantId:string,quantity:number){return prisma.$transaction(async tx=>{const cart=await tx.cart.upsert({where:{userId},create:{userId},update:{}});const existing=await tx.cartItem.findUnique({where:{cartId_variantId:{cartId:cart.id,variantId}}});const nextQuantity=(existing?.quantity??0)+quantity;const variant=await tx.productVariant.findUnique({where:{id:variantId},include:{product:true,inventory:true}});if(!variant)throw new NotFoundError('Product variant not found');const available=variant.inventory?variant.inventory.quantity-variant.inventory.reservedQuantity:0;if(variant.product.status!=='ACTIVE'||available<nextQuantity)throw new InventoryError(`Only ${Math.max(available,0)} of ${variant.sku} are available`);await tx.cartItem.upsert({where:{cartId_variantId:{cartId:cart.id,variantId}},create:{cartId:cart.id,variantId,quantity},update:{quantity:nextQuantity}});return tx.cart.findUniqueOrThrow({where:{id:cart.id},include:cartDetails});},{maxWait:5_000,timeout:15_000});}

 async setItemQuantity(userId:string,variantId:string,quantity:number){const cart=await this.cart(userId);const item=await prisma.cartItem.findUnique({where:{cartId_variantId:{cartId:cart.id,variantId}}});if(!item)throw new NotFoundError('Cart item not found');await this.assertAvailable(variantId,quantity);await prisma.cartItem.update({where:{id:item.id},data:{quantity}});return this.cart(userId);}

 async removeItem(userId:string,variantId:string){const cart=await this.cart(userId);const result=await prisma.cartItem.deleteMany({where:{cartId:cart.id,variantId}});if(!result.count)throw new NotFoundError('Cart item not found');return this.cart(userId);}
}

export const cartService=new CartService();
