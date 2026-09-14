import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { authenticate, authorize } from '../../core/middleware/auth.js';
import { NotFoundError } from '../../core/errors/app-error.js';
import { validate } from '../../core/middleware/validate.js';

const recipeFields = z.object({ title: z.string().trim().min(1).max(200), image: z.string().url().max(2_000), procedures: z.array(z.string().trim().min(1).max(2_000)).min(1).max(100), notes: z.string().trim().max(10_000).nullable().optional(), equipment: z.array(z.string().trim().min(1).max(500)).max(100).default([]) }).strict();
const createRecipe = z.object({ body: recipeFields, params: z.object({}), query: z.object({}) });
const updateRecipe = z.object({ body: recipeFields.partial().refine((value) => Object.keys(value).length > 0), params: z.object({ id: z.string().cuid() }), query: z.object({}) });
const recipeId = z.object({ body: z.object({}).default({}), params: z.object({ id: z.string().cuid() }), query: z.object({}) });
const listRecipes = z.object({ body: z.object({}).default({}), params: z.object({}), query: z.object({ q: z.string().trim().max(200).optional(), page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(12) }) });

export const recipesRouter = Router();
recipesRouter.get('/', validate(listRecipes), async (req, res, next) => { try { const query = listRecipes.shape.query.parse(req.query); const where = query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}; const skip = (query.page - 1) * query.limit; const [items, total] = await prisma.$transaction([prisma.recipe.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: query.limit }), prisma.recipe.count({ where })]); res.json({ success: true, data: { items, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } } }); } catch (error) { next(error); } });
recipesRouter.get('/:id', validate(recipeId), async (req, res, next) => { try { const recipe = await prisma.recipe.findUnique({ where: { id: String(req.params.id) } }); if (!recipe) throw new NotFoundError('Recipe not found'); res.json({ success: true, data: recipe }); } catch (error) { next(error); } });
recipesRouter.post('/', authenticate, authorize('ADMIN'), validate(createRecipe), async (req, res, next) => { try { res.status(201).json({ success: true, data: await prisma.recipe.create({ data: req.body }) }); } catch (error) { next(error); } });
recipesRouter.patch('/:id', authenticate, authorize('ADMIN'), validate(updateRecipe), async (req, res, next) => { try { const existing = await prisma.recipe.findUnique({ where: { id: String(req.params.id) } }); if (!existing) throw new NotFoundError('Recipe not found'); res.json({ success: true, data: await prisma.recipe.update({ where: { id: existing.id }, data: req.body }) }); } catch (error) { next(error); } });
recipesRouter.delete('/:id', authenticate, authorize('ADMIN'), validate(recipeId), async (req, res, next) => { try { const existing = await prisma.recipe.findUnique({ where: { id: String(req.params.id) } }); if (!existing) throw new NotFoundError('Recipe not found'); await prisma.recipe.delete({ where: { id: existing.id } }); res.status(204).send(); } catch (error) { next(error); } });
