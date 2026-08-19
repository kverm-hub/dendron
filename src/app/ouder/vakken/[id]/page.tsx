import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { VerwijderMateriaalKnop } from "@/components/verwijder-materiaal-knop";
import { MateriaalForm } from "@/components/materiaal-form";
import { UploadPanel } from "@/components/upload-panel";

export default async function VakDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: subject } = await supabase.from("subjects").select("*").eq("id", id).single();
  if (!subject) notFound();

  const { data: materials } = await supabase
    .from("materials")
    .select("*")
    .eq("subject_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon name={subject.icon} size={22} />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{subject.name}</h1>
          <p className="text-sm text-slate-500">
            Kennisbank voor de AI-vakdocent van dit vak.
          </p>
        </div>
      </div>

      {subject.ai_instructions && (
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Instructies voor de AI-vakdocent
          </p>
          <p className="mt-1.5 text-sm text-slate-700">{subject.ai_instructions}</p>
        </Card>
      )}

      <UploadPanel subjectId={id} familyId={subject.family_id} />

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          Lesstof {materials && materials.length > 0 && `(${materials.length})`}
        </h2>
        <MateriaalForm subjectId={id} />
      </div>

      {(!materials || materials.length === 0) && (
        <Card>
          <p className="text-sm text-slate-500">
            Nog geen lesstof toegevoegd. Upload hierboven een bestand of voeg handmatig tekst toe.
            Zonder lesstof kan de AI-vakdocent nog niet vakspecifiek helpen.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {materials?.map((m) => (
          <Card key={m.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{m.title}</p>
                {m.uploaded_by_role === "kind" && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    door kind toegevoegd
                  </span>
                )}
                {m.source_type && m.source_type !== "handmatig" && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    {m.source_type === "pdf" ? "PDF" : m.source_type === "afbeelding" ? "foto" : m.source_type}
                  </span>
                )}
              </div>
              {(m.chapter || m.assignment) && (
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  {m.chapter}
                  {m.chapter && m.assignment ? " · " : ""}
                  {m.assignment}
                </p>
              )}
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-slate-500">
                {m.content}
              </p>
              {m.image_urls && m.image_urls.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {m.image_urls.map((url: string, idx: number) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={idx}
                      src={url}
                      alt={`Afbeelding ${idx + 1}`}
                      className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
            <VerwijderMateriaalKnop materialId={m.id} subjectId={id} />
          </Card>
        ))}
      </div>
    </div>
  );
}
