import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { BackToChores, rotationCandidates } from "../shared";
import { EditAllChores, type ChoreDraft } from "./edit-all-chores";

export const metadata = { title: "Edit chores · Tenant" };

export default async function EditAllChoresPage() {
  const { flat } = await requireFlat();
  const supabase = await createClient();
  const [{ data: chores }, { data: rotationRows }, flatmates] = await Promise.all([
    supabase.from("chores").select("*").eq("flat_id", flat.id).order("created_at"),
    supabase.from("chore_rotation").select("chore_id, member_id").eq("flat_id", flat.id).order("position"),
    rotationCandidates(flat.id),
  ]);
  const current = new Set(flatmates.map((f) => f.id));
  const rotations: Record<string, string[]> = {};
  for (const r of rotationRows ?? []) if (current.has(r.member_id)) (rotations[r.chore_id] ??= []).push(r.member_id);

  const initial: ChoreDraft[] = (chores ?? []).map((c) => ({
    key: c.id,
    id: c.id,
    name: c.name,
    days: c.frequency === "daily" ? [1, 2, 3, 4, 5, 6, 7] : [...c.days_of_week].sort((a, b) => a - b),
    dueTime: c.due_time?.slice(0, 5) ?? "",
    rotation: rotations[c.id] ?? [],
    deleted: false,
  }));

  return (
    <div data-wide>
      <header className="mb-5 flex flex-col gap-3">
        <BackToChores />
        <h1 className="text-display font-extrabold lg:text-display-lg">Edit chores</h1>
        <p className="font-medium text-muted">Change any chore here, then save once. Away people are still skipped.</p>
      </header>
      <EditAllChores initial={initial} flatmates={flatmates} />
    </div>
  );
}
