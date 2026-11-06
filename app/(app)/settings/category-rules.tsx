"use client";

import { useFormStatus } from "react-dom";
import type { SplitRule } from "@/lib/supabase/types";
import { setCategoryRule } from "@/app/(app)/money/actions";

const RULES: { value: SplitRule; label: string }[] = [
  { value: "all_members", label: "Everyone, away or not" },
  { value: "present_only", label: "Only people at home" },
  { value: "per_day_worked", label: "Pay by days worked" },
  { value: "custom", label: "Set amounts each time" },
];

function RuleSelect({ id, name, rule }: { id: string; name: string; rule: SplitRule }) {
  const { pending } = useFormStatus();
  return (
    <select
      id={`rule-${id}`}
      name="rule"
      defaultValue={rule}
      disabled={pending}
      aria-label={`Default split for ${name}`}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="min-h-11 max-w-[60%] rounded-lg border border-line-strong bg-surface px-2 text-sm font-semibold disabled:opacity-60"
    >
      {RULES.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

/** Admin: default split rule per category (SPEC 4.1). Saves on change. */
export function CategoryRules({ categories }: { categories: { id: string; name: string; default_rule: SplitRule }[] }) {
  return (
    <ul className="flex flex-col">
      {categories.map((c) => (
        <li key={c.id} className="border-b border-line last:border-b-0">
          <form action={setCategoryRule} className="flex min-h-14 items-center justify-between gap-3">
            <input type="hidden" name="categoryId" value={c.id} />
            <label htmlFor={`rule-${c.id}`} className="font-semibold">
              {c.name}
            </label>
            <RuleSelect id={c.id} name={c.name} rule={c.default_rule} />
          </form>
        </li>
      ))}
    </ul>
  );
}
