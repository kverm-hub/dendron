"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { verwijderToetsvorm } from "./actions";

export function VerwijderToetsvormKnop({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      await verwijderToetsvorm(id);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="rounded-xl p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
      aria-label="Verwijderen"
    >
      <Icon name="trash" size={16} />
    </button>
  );
}
