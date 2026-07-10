"use server";

import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";
import { hashPassword } from "@/server/auth/password";
import { prisma } from "@/server/db/prisma";
import type { AuthActionState } from "@/features/auth/types";

export async function login(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const accountName = String(formData.get("accountName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!accountName || !password) {
    return { error: "アカウント名とパスワードを入力してください。" };
  }

  const user = await prisma.user.findUnique({ where: { accountName } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "アカウント名またはパスワードが正しくありません。" };
  }

  await createSession(user.id);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function register(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const accountName = String(formData.get("accountName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const serverPassword = String(formData.get("serverPassword") ?? "");
  const expectedServerPassword = process.env.SERVER_SHARED_PASSWORD || "newbalance";

  if (accountName.length < 3 || accountName.length > 50) {
    return { error: "ユーザー名は3文字以上50文字以下で入力してください。" };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(accountName)) {
    return { error: "ユーザー名には英数字、ハイフン、アンダースコアのみ使用できます。" };
  }
  if (password.length < 12 || password.length > 128) {
    return { error: "ユーザーパスワードは12文字以上128文字以下で入力してください。" };
  }
  if (serverPassword !== expectedServerPassword) {
    return { error: "サーバー共通パスワードが正しくありません。" };
  }
  if (await prisma.user.findUnique({ where: { accountName }, select: { id: true } })) {
    return { error: "そのユーザー名はすでに使用されています。" };
  }

  const user = await prisma.user.create({
    data: { accountName, passwordHash: await hashPassword(password) },
    select: { id: true },
  });
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
