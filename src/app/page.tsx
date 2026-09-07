import { AgendaApp } from "@/components/agenda/AgendaApp";
import { listBookings } from "@/lib/bookings-service";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureSeed();
  const initialBookings = await listBookings({ includeCancelled: true });
  return (
    <main className="pt-2">
      <AgendaApp initialBookings={initialBookings} />
    </main>
  );
}
