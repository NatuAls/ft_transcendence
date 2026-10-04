-- =============================================================================
--  Role reservations by e-mail.
--
--  An administrator gives a role to an ADDRESS; the person creates the account
--  on their own, and the role reaches it once that address is verified. These
--  two tables hold only the reservations still waiting: a claimed or cancelled
--  one is deleted, and its history is in audit_logs.
--
--  One table per level because each has its own natural key: an address can
--  wait for one platform role, and for one role in each organization.
-- =============================================================================

-- CreateTable
CREATE TABLE "platform_role_grants" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "globalRole" "GlobalRole" NOT NULL,
    "grantedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_role_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_role_grants" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "grantedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_role_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_role_grants_email_key" ON "platform_role_grants"("email");

-- CreateIndex
CREATE INDEX "organization_role_grants_email_idx" ON "organization_role_grants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organization_role_grants_organizationId_email_key" ON "organization_role_grants"("organizationId", "email");

-- AddForeignKey
ALTER TABLE "platform_role_grants" ADD CONSTRAINT "platform_role_grants_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_role_grants" ADD CONSTRAINT "organization_role_grants_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_role_grants" ADD CONSTRAINT "organization_role_grants_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

