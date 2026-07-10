export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { serverTime: Date.now() },
    { headers: { "cache-control": "no-store" } },
  );
}
