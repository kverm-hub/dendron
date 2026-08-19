"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function loginAlsKind(kindId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd." };

  const { data: ouderProfile } = await supabase
    .from("profiles")
    .select("role, family_id")
    .eq("id", user.id)
    .single();

  if (!ouderProfile || ouderProfile.role !== "ouder") {
    return { error: "Alleen ouders kunnen inloggen als hun kind." };
  }

  const { data: kindProfile } = await supabase
    .from("profiles")
    .select("id, family_id, full_name")
    .eq("id", kindId)
    .eq("role", "kind")
    .single();

  if (!kindProfile || kindProfile.family_id !== ouderProfile.family_id) {
    return { error: "Dit kind-account hoort niet bij jouw gezin." };
  }

  const admin = createAdminClient();

  const {
    data: { users },
    error: listError,
  } = await admin.auth.admin.listUsers();

  if (listError || !users) {
    return { error: "Kon kind-accounts niet ophalen." };
  }

  const kindUser = users.find(
    (u) => u.id === kindId || u.user_metadata?.full_name === kindProfile.full_name
  );

  if (!kindUser || !kindUser.email) {
    return { error: "Geen inlogaccount gevonden voor dit kind." };
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: kindUser.email,
  });

  if (linkError || !linkData) {
    return { error: "Kon geen inloglink genereren voor dit kind." };
  }

  const hashedToken = (linkData as { properties?: { hashed_token?: string } }).properties
    ?.hashed_token;

  if (!hashedToken) {
    return { error: "Inlogtoken ontbreekt." };
  }

  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
  });

  if (otpError) {
    return { error: "Inloggen als kind mislukt: " + otpError.message };
  }

  revalidatePath("/kind");
  return { success: true };
}
