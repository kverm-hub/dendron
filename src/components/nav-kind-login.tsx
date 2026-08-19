"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Icon } from "@/components/icon";
import { loginAlsKind } from "@/app/ouder/account/login-as-kind";

export function NavKindLogin({
  kindId,
  kindName,
}: {
  kindId: string | null;
  kindName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!kindId || !kindName) return null;

  function handleLogin() {
    startTransition(async () => {
      const result = await loginAlsKind(kindId!);
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
      className={clsx(
        "mt-2 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
        "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
      )}
    >
      <Icon name="login" size={20} />
      {pending ? "Bezig..." : `Inloggen als ${kindName.split(" ")[0]}`}
    </button>
  );
}
