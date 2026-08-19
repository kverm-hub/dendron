"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { slaRoosterOp, verwijderRooster } from "./actions";
import type { Subject, ScheduleBlock } from "@/lib/types";

const DAGEN = [
  { num: 1, label: "Maandag" },
  { num: 2, label: "Dinsdag" },
  { num: 3, label: "Woensdag" },
  { num: 4, label: "Donderdag" },
  { num: 5, label: "Vrijdag" },
];

const BLOCK_TYPES = [
  { value: "les", label: "Les" },
  { value: "pauze", label: "Pauze" },
  { value: "reis", label: "Reizen" },
  { value: "vrij", label: "Vrij" },
];

interface Blok {
  day_of_week: number;
  start_time: string;
  end_time: string;
  block_type: string;
  subject_id: string | null;
  label: string;
}

export function RoosterForm({
  subjects,
  existingBlocks,
}: {
  subjects: Subject[];
  existingBlocks: ScheduleBlock[];
}) {
  const router = useRouter();
  const [blokken, setBlokken] = useState<Record<number, Blok[]>>(() => {
    const init: Record<number, Blok[]> = {};
    for (const dag of DAGEN) init[dag.num] = [];
    for (const block of existingBlocks) {
      if (!init[block.day_of_week]) init[block.day_of_week] = [];
      init[block.day_of_week].push({
        day_of_week: block.day_of_week,
        start_time: block.start_time.slice(0, 5),
        end_time: block.end_time.slice(0, 5),
        block_type: block.block_type,
        subject_id: block.subject_id,
        label: block.label,
      });
    }
    return init;
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function voegBlokToe(dag: number) {
    setBlokken((prev) => ({
      ...prev,
      [dag]: [
        ...prev[dag],
        { day_of_week: dag, start_time: "08:30", end_time: "09:30", block_type: "les", subject_id: null, label: "" },
      ],
    }));
  }

  function verwijderBlok(dag: number, idx: number) {
    setBlokken((prev) => ({
      ...prev,
      [dag]: prev[dag].filter((_, i) => i !== idx),
    }));
  }

  function updateBlok(dag: number, idx: number, veld: keyof Blok, waarde: string | null) {
    setBlokken((prev) => ({
      ...prev,
      [dag]: prev[dag].map((b, i) => (i === idx ? { ...b, [veld]: waarde } : b)),
    }));
  }

  async function handleSave(formData: FormData) {
    setSaving(true);
    setError(null);
    const res = await slaRoosterOp(formData);
    if (res?.error) {
      setError(res.error);
      setSaving(false);
      return;
    }
    setSaving(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Weet je zeker dat je het hele rooster wilt wissen?")) return;
    const res = await verwijderRooster();
    if (res?.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <form action={handleSave} className="flex flex-col gap-5">
        {DAGEN.map((dag) => (
          <Card key={dag.num}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{dag.label}</h3>
              <button
                type="button"
                onClick={() => voegBlokToe(dag.num)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                <Icon name="plus" size={14} />
                Blok toevoegen
              </button>
            </div>

            {blokken[dag.num].length === 0 && (
              <p className="text-xs text-slate-400">Geen blokken voor deze dag.</p>
            )}

            <div className="flex flex-col gap-2">
              {blokken[dag.num].map((blok, idx) => {
                const prefix = `block_${dag.num}_${idx}_`;
                return (
                  <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3 py-2">
                    <input type="hidden" name={prefix + "day"} value={dag.num} />

                    <input
                      type="time"
                      name={prefix + "start"}
                      value={blok.start_time}
                      onChange={(e) => updateBlok(dag.num, idx, "start_time", e.target.value)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">tot</span>
                    <input
                      type="time"
                      name={prefix + "end"}
                      value={blok.end_time}
                      onChange={(e) => updateBlok(dag.num, idx, "end_time", e.target.value)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                    />

                    <select
                      name={prefix + "type"}
                      value={blok.block_type}
                      onChange={(e) => updateBlok(dag.num, idx, "block_type", e.target.value)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                    >
                      {BLOCK_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>

                    {blok.block_type === "les" && (
                      <select
                        name={prefix + "subject"}
                        value={blok.subject_id ?? ""}
                        onChange={(e) => updateBlok(dag.num, idx, "subject_id", e.target.value || null)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Geen vak</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}

                    <input
                      type="text"
                      name={prefix + "label"}
                      value={blok.label}
                      onChange={(e) => updateBlok(dag.num, idx, "label", e.target.value)}
                      placeholder="Label (bijv. wiskunde, fietsen)"
                      className="min-w-[120px] flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => verwijderBlok(dag.num, idx)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Verwijder blok"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Opslaan..." : "Rooster opslaan"}
          </Button>
          {existingBlocks.length > 0 && (
            <Button type="button" variant="danger" onClick={handleDelete}>
              Rooster wissen
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
