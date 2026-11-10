import { requireFlat } from "@/lib/flat";
import { todayIn } from "@/lib/engine/dates";
import { ChoreForm } from "../chore-form";
import { BackToChores, rotationCandidates } from "../shared";

export const metadata = { title: "Add chore · Tenant" };

export default async function NewChorePage() {
  const { me, flat } = await requireFlat();
  const flatmates = await rotationCandidates(flat.id);
  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        <BackToChores />
        <h1 className="text-display font-extrabold">Add chore</h1>
      </header>
      <div className="rounded-[var(--radius-card)] bg-surface p-5 md:p-7">
        <ChoreForm
          flatmates={flatmates}
          today={todayIn(flat.timezone)}
          meId={me.id}
          initial={{ name: "", frequency: "daily", days: [], dueTime: "", rotation: flatmates.map((f) => f.id) }}
        />
      </div>
    </>
  );
}
