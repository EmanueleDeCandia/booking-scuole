import { CoursesShowcaseClient } from "@/components/CoursesShowcaseClient";

export const metadata = {
  title: "Corsi & Sondaggio Appeal · Naïve Studio",
  description: "Esplora i nuovi corsi in programma, vota l'indice di gradimento e iscriviti alle discipline attive della scuola.",
};

export default function CorsiPage() {
  return (
    <main className="py-6 sm:py-10">
      <CoursesShowcaseClient />
    </main>
  );
}
