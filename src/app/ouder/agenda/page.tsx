import { createClient } from "@/lib/supabase/server";
import { AgendaBoard } from "@/components/agenda-board";

export default async function OuderAgendaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user!.id)
    .single();

  const [{ data: items }, { data: subjects }, { data: testTypes }] = await Promise.all([
    supabase
      .from("planning_items")
      .select("*")
      .eq("family_id", profile!.family_id)
      .order("due_date", { ascending: true }),
    supabase.from("subjects").select("*").eq("family_id", profile!.family_id),
    supabase.from("test_types").select("*").eq("family_id", profile!.family_id),
  ]);

  // Haal roosterblokken op
  const { data: schedule } = await supabase
    .from("schedules")
    .select("id")
    .eq("family_id", profile!.family_id)
    .maybeSingle();

  let scheduleBlocks: import("@/lib/types").ScheduleBlock[] = [];

  if (schedule) {
    const { data: blocks } = await supabase
      .from("schedule_blocks")
      .select("*")
      .eq("schedule_id", schedule.id)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    scheduleBlocks = (blocks ?? []) as import("@/lib/types").ScheduleBlock[];
  }

  return (
    <AgendaBoard
      items={items ?? []}
      subjects={subjects ?? []}
      testTypes={testTypes ?? []}
      scheduleBlocks={scheduleBlocks}
    />
  );
}
