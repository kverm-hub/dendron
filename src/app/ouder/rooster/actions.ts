"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function slaRoosterOp(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, family_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "ouder") {
    return { error: "Alleen ouders kunnen het rooster instellen." };
  }

  // Zoek of maak een schedule voor dit gezin
  const { data: existing } = await supabase
    .from("schedules")
    .select("id")
    .eq("family_id", profile.family_id)
    .maybeSingle();

  let scheduleId = existing?.id;

  if (!scheduleId) {
    const { data: newSchedule, error: createError } = await supabase
      .from("schedules")
      .insert({ family_id: profile.family_id })
      .select("id")
      .single();

    if (createError) return { error: createError.message };
    scheduleId = newSchedule!.id;
  }

  // Verwijder bestaande blokken voor dit rooster
  await supabase.from("schedule_blocks").delete().eq("schedule_id", scheduleId);

  // Haal alle blokken uit formData. Formaat: block_<dag>_<index>_<veld>
  const blokken: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    block_type: string;
    subject_id: string | null;
    label: string;
  }[] = [];

  const formEntries = Array.from(formData.entries());
  const dagSet = new Set<number>();

  for (const [key, value] of formEntries) {
    const match = key.match(/^block_(\d+)_(\d+)_day$/);
    if (match) {
      const dag = parseInt(match[1], 10);
      const idx = parseInt(match[2], 10);
      dagSet.add(dag);

      const prefix = `block_${dag}_${idx}_`;
      const startTime = String(formData.get(prefix + "start") || "");
      const endTime = String(formData.get(prefix + "end") || "");
      const blockType = String(formData.get(prefix + "type") || "les");
      const subjectId = String(formData.get(prefix + "subject") || "") || null;
      const label = String(formData.get(prefix + "label") || "").trim();

      if (startTime && endTime) {
        blokken.push({
          day_of_week: dag,
          start_time: startTime,
          end_time: endTime,
          block_type: blockType,
          subject_id: subjectId,
          label,
        });
      }
    }
  }

  if (blokken.length > 0) {
    const { error: insertError } = await supabase.from("schedule_blocks").insert(
      blokken.map((b) => ({
        schedule_id: scheduleId,
        ...b,
      }))
    );

    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/ouder/rooster");
  revalidatePath("/ouder/agenda");
  revalidatePath("/kind/agenda");
  return { success: true };
}

export async function verwijderRooster() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, family_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "ouder") {
    return { error: "Alleen ouders kunnen het rooster verwijderen." };
  }

  await supabase.from("schedules").delete().eq("family_id", profile.family_id);

  revalidatePath("/ouder/rooster");
  revalidatePath("/ouder/agenda");
  revalidatePath("/kind/agenda");
  return { success: true };
}
