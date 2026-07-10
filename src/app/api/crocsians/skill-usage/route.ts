import { getCurrentUser } from "@/server/auth/session";
import { getSkillUsage } from "@/server/services/crocsians-skill-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  return Response.json(await getSkillUsage(user.id), { headers: { "cache-control": "no-store" } });
}
