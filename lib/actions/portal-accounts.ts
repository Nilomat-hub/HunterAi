"use server";

import { Portal } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({
  portal: z.nativeEnum(Portal),
  username: z.string().min(1),
  password: z.string().min(1)
});

export async function savePortalAccount(formData: FormData) {
  const userId = await requireUserId();
  const parsed = schema.parse(Object.fromEntries(formData));

  await prisma.portalAccount.upsert({
    where: {
      userId_portal: {
        userId,
        portal: parsed.portal
      }
    },
    create: {
      userId,
      portal: parsed.portal,
      usernameEncrypted: encryptSecret(parsed.username),
      passwordEncrypted: encryptSecret(parsed.password)
    },
    update: {
      usernameEncrypted: encryptSecret(parsed.username),
      passwordEncrypted: encryptSecret(parsed.password)
    }
  });

  revalidatePath("/dashboard/portal-accounts");
}
