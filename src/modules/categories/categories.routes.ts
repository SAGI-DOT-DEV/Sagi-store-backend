import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { authenticate, authorize } from '../../core/middleware/auth.js';
import { ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import { validate } from '../../core/middleware/validate.js';

const categoryFields = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1_000).nullable().optional(),
}).strict();

const createCategory = z.object({ body: categoryFields, params: z.object({}), query: z.object({}) });
const updateCategory = z.object({ body: categoryFields.partial().refine(value => Object.keys(value).length > 0), params: z.object({ id: z.string().cuid() }), query: z.object({}) });
const categoryId = z.object({ body: z.object({}).default({}), params: z.object({ id: z.string().cuid() }), query: z.object({}) });

export const categoriesRouter = Router();

categoriesRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } }) });
  } catch (error) { next(error); }
});

categoriesRouter.post('/', authenticate, authorize('ADMIN'), validate(createCategory), async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await prisma.category.create({ data: req.body }) });
  } catch (error) { next(error); }
});

categoriesRouter.patch('/:id', authenticate, authorize('ADMIN'), validate(updateCategory), async (req, res, next) => {
  try {
    const category = await prisma.category.update({ where: { id: String(req.params.id) }, data: req.body });
    res.json({ success: true, data: category });
  } catch (error) { next(error); }
});

categoriesRouter.delete('/:id', authenticate, authorize('ADMIN'), validate(categoryId), async (req, res, next) => {
  try {
    const category = await prisma.category.findUnique({ where: { id: String(req.params.id) } });
    if (!category) throw new NotFoundError('Category not found');
    if (await prisma.product.count({ where: { categoryId: category.id } })) throw new ConflictError('Remove or reassign products before deleting this category');
    await prisma.category.delete({ where: { id: category.id } });
    res.status(204).send();
  } catch (error) { next(error); }
});
