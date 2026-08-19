import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { ToetsvormForm } from "./toetsvorm-form";
import { VerwijderToetsvormKnop } from "./verwijder-knop";

export default async function ToetsvormenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user!.id)
    .single();

  const { data: toetsvormen } = await supabase
    .from("test_types")
    .select("*")
    .eq("family_id", me!.family_id)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Toetsvormen</h1>
        <p className="mt-1 text-sm text-slate-500">
          Stel verschillende soorten toetsen in met bijpassend studie-advies.
          Bij het plannen van een toets kies je welke vorm het is, en de agenda
          stelt het juiste aantal leermomenten voor op de juiste tijdstippen.
        </p>
      </div>

      {toetsvormen && toetsvormen.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-slate-900">Bestaande toetsvormen</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {toetsvormen.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3.5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full bg-${t.color}-500`} />
                    <span className="text-sm font-semibold text-slate-900">{t.name}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t.study_sessions} leermomenten, {t.lead_days} dagen vooraf beginnen
                  </p>
                  {t.description && (
                    <p className="mt-0.5 text-xs text-slate-400">{t.description}</p>
                  )}
                </div>
                <VerwijderToetsvormKnop id={t.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ToetsvormForm />
    </div>
  );
}
