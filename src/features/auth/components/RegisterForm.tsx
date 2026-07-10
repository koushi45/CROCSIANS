"use client";

import { useActionState } from "react";
import { register } from "@/features/auth/actions";
import type { AuthActionState } from "@/features/auth/types";

const initialState: AuthActionState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, initialState);
  const inputClass = "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2.5 outline-none focus:border-amber-400";
  return (
    <form action={action} className="space-y-5">
      <label className="block space-y-2 text-sm font-semibold"><span>ユーザー名</span><input name="accountName" autoComplete="username" required minLength={3} maxLength={50} pattern="[a-zA-Z0-9_-]+" className={inputClass} /></label>
      <label className="block space-y-2 text-sm font-semibold"><span>ユーザーパスワード</span><input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className={inputClass} /><small className="font-normal text-zinc-400">12文字以上で設定してください。</small></label>
      <label className="block space-y-2 text-sm font-semibold"><span>サーバー共通パスワード</span><input name="serverPassword" type="password" autoComplete="off" required className={inputClass} /></label>
      {state.error && <p className="rounded-md bg-red-950/50 px-3 py-2 text-sm text-red-300">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-md bg-amber-400 px-4 py-2.5 font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-60">{pending ? "登録中..." : "登録してゲームを始める"}</button>
    </form>
  );
}
