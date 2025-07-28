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
    // Add connection management to prevent prepared statement conflicts
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Function to reset connection when prepared statement errors occur
export const resetPrismaConnection = async () => {
  try {
    await prisma.$disconnect();
    // Wait longer to clear any stuck connections
    await new Promise(resolve => setTimeout(resolve, 3000));
    // Force a new connection
    await prisma.$connect();
    console.log("[Prisma] Connection reset successfully");
  } catch (error) {
    console.error("[Prisma] Error resetting connection:", error);
  }
};

// Event handling for development
if (process.env.NODE_ENV === "development") {
  prisma.$on("query" as never, (e: Prisma.QueryEvent) => {
    if (e.duration > 100) {
      // Only log slow queries
      console.log(`[Prisma Query] ${e.duration}ms ${e.query}`);
    }
  });
}

// Handle connection cleanup on process termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
