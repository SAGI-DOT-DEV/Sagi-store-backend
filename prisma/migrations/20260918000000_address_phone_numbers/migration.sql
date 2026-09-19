-- Nullable columns preserve existing customer addresses.
ALTER TABLE "Address" ADD COLUMN "phone" TEXT, ADD COLUMN "phone2" TEXT;
