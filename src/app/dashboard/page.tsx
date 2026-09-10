import { DashboardClient } from "@/components/DashboardClient";
import { listBookings, listNotifications, runReminderSweep } from "@/lib/bookings-service";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await ensureSeed();
  await runReminderSweep();
  const [bookings, notifications] = await Promise.all([
    listBookings({ includeCancelled: true }),
    listNotifications(50, { role: "manager" }),
  ]);
  return (
    <main className="pt-2">
      <DashboardClient initialBookings={bookings} initialNotifications={notifications.items} />
    </main>
  );
}
