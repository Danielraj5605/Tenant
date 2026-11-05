import { requireFlat } from "@/lib/flat";
import { ChoreForm } from "../chore-form";
import { BackToChores, rotationCandidates } from "../shared";

export const metadata = { title: "Add chore · Tenant" };

export default async function NewChorePage() {
  const { flat } = await requireFlat();
  const flatmates = await rotationCandidates(flat.id);
  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        <BackToChores />
        <h1 className="text-display font-extrabold">Add chore</h1>
      </header>
      <ChoreForm
        flatmates={flatmates}
        initial={{ name: "", frequency: "daily", days: [], dueTime: "", rotation: flatmates.map((f) => f.id) }}
      />
    </>
  );
}
