CREATE TABLE "DeviceMutation" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "requestHash" TEXT NOT NULL,
 "result" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DeviceMutation_userId_createdAt_idx" ON "DeviceMutation"("userId","createdAt");
ALTER TABLE "DeviceMutation" ENABLE ROW LEVEL SECURITY;
