-- CreateTable
CREATE TABLE "MobileHandoff" (
    "token" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileHandoff_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "MobileHandoff_expires_idx" ON "MobileHandoff"("expires");
