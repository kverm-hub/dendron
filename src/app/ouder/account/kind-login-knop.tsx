"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { loginAlsKind } from "./login-as-kind";

export function KindLoginKnop({ kindId, kindName }: { kindId: string; kindName: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleLogin() {
    startTransition(async () => {
      const result = await loginAlsKind(kindId);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.push("/kind");
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleLogin}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
    >
      <Icon name="login" size={14} />
      {pending ? "Bezig..." : `Inloggen als ${kindName.split(" ")[0]}`}
    </button>
  );
}
