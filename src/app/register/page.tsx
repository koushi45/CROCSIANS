import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "新規登録 | CROCSIANS" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  return <main className="flex min-h-screen items-center justify-center bg-[#10130f] px-4 py-12 text-zinc-100"><section className="w-full max-w-md rounded-lg border border-zinc-700 bg-[#191d18] p-7 shadow-xl"><p className="text-xs font-bold tracking-[0.3em] text-amber-400">CROCSIANS</p><h1 className="mt-2 text-2xl font-semibold">新規登録</h1><p className="mb-7 mt-2 text-sm text-zinc-400">プレイヤーアカウントを作成します。</p><RegisterForm /><p className="mt-6 text-center text-sm text-zinc-400">すでにアカウントをお持ちですか？ <Link href="/login" className="text-amber-400 underline">ログイン</Link></p></section></main>;
}
