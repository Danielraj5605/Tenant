"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { LogOutIcon } from "@/components/icons";
import { signOut } from "@/app/login/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" loading={pending}>
      {pending ? null : <LogOutIcon size={20} />}
      Sign out
    </Button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Submit />
    </form>
  );
}
