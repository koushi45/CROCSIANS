import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new Response(null, { status: 404 });
  const message = await prisma.crocsiansChatMessage.findUnique({ where: { id }, select: { imageData: true, imageContentType: true, imageExpiresAt: true } });
  if (!message?.imageData || !message.imageContentType || !message.imageExpiresAt) return new Response(null, { status: 404 });
  if (message.imageExpiresAt.getTime() <= Date.now()) {
    await prisma.crocsiansChatMessage.update({ where: { id }, data: { imageData: null, imageContentType: null } });
    return new Response(null, { status: 410 });
  }
  return new Response(message.imageData, { headers: { "content-type": message.imageContentType, "cache-control": "private, max-age=300" } });
}
