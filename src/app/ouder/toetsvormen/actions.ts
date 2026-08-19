"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidate() {
  revalidatePath("/ouder/toetsvormen");
  revalidatePath("/ouder/agenda");
  revalidatePath("/ouder");
}

export async function maakToetsvorm(formData: FormData) {
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
    return { error: "Alleen ouders kunnen toetsvormen aanmaken." };
  }

  const name = String(formData.get("name") || "").trim();
  const color = String(formData.get("color") || "blue");
  const studySessions = parseInt(String(formData.get("studySessions") || "3"), 10);
  const leadDays = parseInt(String(formData.get("leadDays") || "7"), 10);
  const description = String(formData.get("description") || "").trim();

  if (!name) return { error: "Vul een naam in." };

  const { error } = await supabase.from("test_types").insert({
    family_id: profile.family_id,
    name,
    color,
    study_sessions: isNaN(studySessions) ? 3 : studySessions,
    lead_days: isNaN(leadDays) ? 7 : leadDays,
    description,
  });

  if (error) return { error: error.message };

  revalidate();
  return { success: true };
}

export async function verwijderToetsvorm(id: string) {
  const supabase = await createClient();
  await supabase.from("test_types").delete().eq("id", id);
  revalidate();
}
