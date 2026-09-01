-- CreateTable
CREATE TABLE "ShippingSettings" (
    "id" TEXT NOT NULL,
    "freeShippingThreshold" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "shipFromName" TEXT NOT NULL,
    "shipFromCompany" TEXT,
    "shipFromPhone" TEXT,
    "shipFromEmail" TEXT,
    "shipFromStreet1" TEXT NOT NULL,
    "shipFromStreet2" TEXT,
    "shipFromCity" TEXT NOT NULL,
    "shipFromState" TEXT,
    "shipFromPostalCode" TEXT NOT NULL,
    "shipFromCountry" TEXT NOT NULL DEFAULT 'CA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShippingSettings_pkey" PRIMARY KEY ("id")
);
