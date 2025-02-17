import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaClientSingleton = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [
            {
              emit: "event",
              level: "query",
            },
          ]
        : [],
  });
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Event handling for development
if (process.env.NODE_ENV === "development") {
  prisma.$on("query" as never, (e: Prisma.QueryEvent) => {
    if (e.duration > 100) {
      // Only log slow queries
      console.log(`[Prisma Query] ${e.duration}ms ${e.query}`);
    }
  });
}
