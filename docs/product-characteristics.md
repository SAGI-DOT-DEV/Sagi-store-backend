# Optional product characteristics

Product create and update accept:

- `origin`: optional text, maximum 150 characters. Send `null` or an empty string to clear.
- `highlights`: optional array of up to five non-empty labels, maximum 40 characters each. Send `[]` to clear.

Omitting a field on PATCH leaves its current value unchanged. Existing products have no origin and an empty highlights list.

Example admin PATCH to `/api/v1/products/<productId>`:

```json
{
  "origin": "Ijebu Ode, Ogun State",
  "highlights": ["Naturally fermented", "Stone-ground"]
}
```

Only use descriptions that are true of the product. These are descriptive labels, not inventory or certification badges. The catalog displays up to two highlights and omits empty characteristics. Categories come from the actual linked category.

## Deployment

An additive migration is included in `prisma/migrations/20260911090000_product_characteristics`.
Confirm your database connection targets the intended database before running:

```sh
npx prisma migrate deploy
npx prisma generate
```

Stop the local backend first if Windows reports a locked Prisma engine DLL. Restart the backend after migration and generation. Do not use database reset.
