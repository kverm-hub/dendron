"use client";

import { useActionState } from "react";
import { maakToetsvorm } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type State = { error?: string; success?: boolean };

const KLEUREN = [
  { value: "blue", label: "Blauw", class: "bg-blue-500" },
  { value: "rose", label: "Rood", class: "bg-rose-500" },
  { value: "amber", label: "Geel", class: "bg-amber-500" },
  { value: "emerald", label: "Groen", class: "bg-emerald-500" },
  { value: "violet", label: "Paars", class: "bg-violet-500" },
];

export function ToetsvormForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => (await maakToetsvorm(formData)) as State,
    {}
  );

  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-900">Nieuwe toetsvorm</h2>
      <p className="mt-1 text-sm text-slate-500">
        Verschillende toetsen vragen verschillende voorbereiding. Bij een kleine
        SO (schriftelijke overhoring) leer je kort van tevoren, bij een toetsweek
        begin je eerder en spreid je meer.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Naam (bijv. SO, MO, Toetsweek, Proefwerk)
          </label>
          <input
            name="name"
            required
            placeholder="bijv. SO"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Aantal leermomenten
            </label>
            <input
              type="number"
              name="studySessions"
              min={1}
              max={10}
              defaultValue={3}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-xs text-slate-400">
              Hoe vaak spreekt het af om te leren?
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Dagen vooraf beginnen
            </label>
            <input
              type="number"
              name="leadDays"
              min={1}
              max={60}
              defaultValue={7}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-xs text-slate-400">
              Hoeveel dagen voor de toets starten?
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Kleur
          </label>
          <div className="flex flex-wrap gap-2">
            {KLEUREN.map((k) => (
              <label key={k.value} className="flex cursor-pointer items-center gap-1.5">
                <input type="radio" name="color" value={k.value} className="sr-only peer" defaultChecked={k.value === "blue"} />
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${k.class} peer-checked:ring-2 peer-checked:ring-slate-900 peer-checked:ring-offset-2`} />
                <span className="text-xs text-slate-600">{k.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Toelichting (optioneel)
          </label>
          <textarea
            name="description"
            rows={2}
            placeholder="bijv. Korte overhoring, concentreer op de laatste les."
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
        {state.success && (
          <p className="text-sm text-emerald-600">Toetsvorm toegevoegd.</p>
        )}

        <Button type="submit" disabled={pending} className="mt-1">
          {pending ? "Bezig..." : "Toevoegen"}
        </Button>
      </form>
    </Card>
  );
}
