import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: "ログイン | CROCSIANS" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next = "" } = await searchParams;

  return (
    <main data-login-page className="flex min-h-screen items-center justify-center bg-[#f5f3ee] px-4 py-12 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-bold tracking-[0.3em] text-amber-500">CROCSIANS</p><h1 className="mt-2 text-2xl font-semibold">ログイン</h1>
        <p className="mb-7 mt-2 text-sm text-zinc-600 dark:text-zinc-400">認証状態はログイン後24時間有効です。</p>
        <LoginForm next={next} />
        <p className="mt-6 text-center text-sm text-zinc-500">初めての方は <Link href="/register" className="font-semibold text-amber-600 underline">新規登録</Link></p>
      </section>
    </main>
  );
}
