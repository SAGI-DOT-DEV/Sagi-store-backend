import { prisma } from '../../database/prisma.js';

// Explicit selection prevents password hashes, sessions and tokens leaving the API.
export function listAdminUsers() {
  return prisma.user.findMany({
    select: { id:true, email:true, role:true, createdAt:true, emailVerifiedAt:true,
      profile:{select:{firstName:true,lastName:true}} },
    orderBy:[{createdAt:'desc'},{id:'desc'}],
  });
}
