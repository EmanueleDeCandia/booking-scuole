import { ProfileClient } from "@/components/ProfileClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Il Mio Profilo Allievo · Naïve Agenda",
  description: "Visualizza i tuoi corsi, le presenze, sposta o prenota lezioni e gestisci la foto del tuo profilo.",
};

export default function ProfilePage() {
  return (
    <main className="py-4">
      <ProfileClient />
    </main>
  );
}
