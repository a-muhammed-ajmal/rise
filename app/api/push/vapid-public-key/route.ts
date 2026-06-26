export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) {
    return Response.json({ error: "VAPID key not configured" }, { status: 500 });
  }
  return Response.json({ publicKey: key });
}
