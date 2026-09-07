import { getStats } from "@/lib/bookings-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getStats();
  return Response.json(stats);
}
