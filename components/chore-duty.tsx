"use client";

import { useFormStatus } from "react-dom";
import { setChoreDone } from "@/app/(app)/chores/actions";
import { Button } from "./ui";
import { CheckIcon } from "./icons";

function Submit({ done, forName }: { done: boolean; forName?: string }) {
  const { pending } = useFormStatus();
  return done ? (
    <Button type="submit" variant="ghost" loading={pending} className="min-h-11 w-auto px-4 text-sm">
      Undo
    </Button>
  ) : (
    <Button type="submit" loading={pending}>
      {pending ? null : <CheckIcon size={20} />}
      {forName ? `Mark done for ${forName}` : "Mark done"}
    </Button>
  );
}

/**
 * "Mark done" for the owner of today's duty (or the admin, for someone else:
 * pass `forName`); "Undo" once done.
 */
export function DutyButton({ assignmentId, done, forName }: { assignmentId: string; done: boolean; forName?: string }) {
  return (
    <form action={setChoreDone}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="done" value={done ? "false" : "true"} />
      <Submit done={done} forName={forName} />
    </form>
  );
}
