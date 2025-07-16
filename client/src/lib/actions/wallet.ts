"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";

const saveWalletSchema = z.object({
  address: z.string(),
});

export async function saveWalletToDb(payload: { address: string }) {
  try {
    const { address } = saveWalletSchema.parse(payload);

    const user = await prisma.user.upsert({
      where: { address },
      update: {}, // No need to update anything
      create: {
        address,
      },
    });

    return { success: true, user };
  } catch (error) {
    console.error("Error saving wallet:", error);
    throw new Error("Failed to save wallet to database");
  }
}
