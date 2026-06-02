"use server";

import { Portal } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  const parsed = schema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect("/dashboard/portal-accounts?error=validation");
  }

  await prisma.portalAccount.upsert({
    where: {
      userId_portal: {
        userId,
        portal: parsed.data.portal
      }
    },
    create: {
      userId,
      portal: parsed.data.portal,
      usernameEncrypted: encryptSecret(parsed.data.username),
      passwordEncrypted: encryptSecret(parsed.data.password)
    },
    update: {
      usernameEncrypted: encryptSecret(parsed.data.username),
      passwordEncrypted: encryptSecret(parsed.data.password)
    }
  });

  revalidatePath("/dashboard/portal-accounts");
}
