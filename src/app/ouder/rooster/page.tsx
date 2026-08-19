import { createClient } from "@/lib/supabase/server";
import { RoosterForm } from "./rooster-form";

export default async function RoosterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user!.id)
    .single();

  const [{ data: subjects }, { data: schedule }] = await Promise.all([
    supabase.from("subjects").select("*").eq("family_id", profile!.family_id),
    supabase.from("schedules").select("id").eq("family_id", profile!.family_id).maybeSingle(),
  ]);

  let blocks: import("@/lib/types").ScheduleBlock[] = [];
  if (schedule) {
    const { data: rawBlocks } = await supabase
      .from("schedule_blocks")
      .select("*")
      .eq("schedule_id", schedule.id)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    blocks = (rawBlocks ?? []) as import("@/lib/types").ScheduleBlock[];
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Schoolrooster</h1>
        <p className="mt-1 text-sm text-slate-500">
          Voer het vaste weekrooster in. Lesuren, pauzes en reistijd worden in de
          agenda getoond als gekleurde blokken, zodat je ziet wanneer er tijd is
          voor huiswerk en leermomenten.
        </p>
      </div>

      <RoosterForm subjects={subjects ?? []} existingBlocks={blocks} />
    </div>
  );
}
