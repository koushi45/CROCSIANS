import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { inspectCharacterIcon } from "@/server/services/crocsians-icon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "ログインが必要です。" }, { status: 401 });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const requestedUserId = new URL(request.url).searchParams.get("userId");
  const icon = await prisma.crocsiansCharacterIcon.findUnique({ where: { userId: requestedUserId || user.id }, select: { data: true, contentType: true } });
  if (!icon) return new Response(null, { status: 404 });
  return new Response(icon.data, { headers: { "content-type": icon.contentType, "cache-control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const requestedContentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (requestedContentType !== "image/webp" && requestedContentType !== "image/png") return Response.json({ error: "WebPまたはPNG画像を指定してください。" }, { status: 415 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  const metadata = inspectCharacterIcon(bytes);
  if (!metadata || metadata.contentType !== requestedContentType) return Response.json({ error: "アイコンは256×256px、1MB以下の画像にしてください。" }, { status: 400 });

  await prisma.crocsiansCharacterIcon.upsert({
    where: { userId: user.id },
    create: { userId: user.id, contentType: metadata.contentType, data: bytes },
    update: { contentType: metadata.contentType, data: bytes },
  });
  return Response.json({ url: `/api/crocsians/icon?userId=${encodeURIComponent(user.id)}&v=${Date.now()}` });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  await prisma.crocsiansCharacterIcon.deleteMany({ where: { userId: user.id } });
  return Response.json({ deleted: true });
}
