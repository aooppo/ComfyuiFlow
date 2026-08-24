-- PostgreSQL makes newly-added enum values visible only after the preceding
-- transaction commits. Keep the data/default transition in a separate Prisma
-- migration so an upgrade works on supported PostgreSQL versions.
ALTER TABLE "StoredObject" ALTER COLUMN "verificationStatus" SET DEFAULT 'PRESERVED';
ALTER TABLE "StoredObject" ALTER COLUMN "verifiedAt" DROP NOT NULL;
ALTER TABLE "Asset" ALTER COLUMN "status" SET DEFAULT 'PRESERVED';
UPDATE "Asset" SET "status" = 'PRESERVED' WHERE "status" = 'READY';
UPDATE "StoredObject" SET "verificationStatus" = 'PRESERVED' WHERE "verificationStatus" = 'VERIFIED';
