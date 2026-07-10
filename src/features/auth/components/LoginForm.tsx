"use client";

import { useActionState } from "react";
import { login } from "@/features/auth/actions";
import type { AuthActionState } from "@/features/auth/types";

const initialState: AuthActionState = {};

export function LoginForm({ next = "" }: { next?: string }) {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-2 text-sm font-semibold">
        <span>アカウント名</span>
        <input name="accountName" autoComplete="username" required className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-950" />
      </label>
      <label className="block space-y-2 text-sm font-semibold">
        <span>パスワード</span>
        <input name="password" type="password" autoComplete="current-password" required className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-950" />
      </label>
      {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-md bg-zinc-950 px-4 py-2.5 font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950">
        {pending ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
