import { auth } from "@/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { title } = await req.json();
  return Response.json({ title, owner: session.user.id });
}
