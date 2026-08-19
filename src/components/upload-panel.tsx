"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icon";

type UploadStatus = "idle" | "uploading" | "verwerken" | "klaar" | "fout";

interface UploadResult {
  title: string;
  chapter: string | null;
  assignment: string | null;
  contentPreview: string;
}

export function UploadPanel({ subjectId, familyId }: { subjectId: string; familyId: string }) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const file = files[0];
    setStatus("uploading");
    setError(null);
    setResult(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Niet ingelogd.");

      const fileExt = file.name.split(".").pop()?.toLowerCase() || "bin";
      const filePath = `${familyId}/uploads/${Date.now()}-${file.name.replace(/\s/g, "-")}`;

      const { error: uploadError } = await supabase.storage
        .from("lesstof")
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) throw new Error("Bestand uploaden mislukt: " + uploadError.message);

      setStatus("verwerken");

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-upload`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          filePath,
          fileType: file.type || (fileExt === "pdf" ? "application/pdf" : "text/plain"),
          fileName: file.name,
          subjectId,
          familyId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Verwerkingsfout" }));
        throw new Error(errData.error || `Verwerken mislukt (${response.status})`);
      }

      const data = await response.json();
      setResult({
        title: data.title || file.name,
        chapter: data.chapter,
        assignment: data.assignment,
        contentPreview: data.contentPreview || "",
      });
      setStatus("klaar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout.");
      setStatus("fout");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Bestand uploaden & omzetten</h3>
        <p className="mt-1 text-sm text-slate-500">
          Upload een PDF, foto van je tekstboek, of werkblad. De AI leest het bestand en
          zet het om naar gestructureerde kennisbank-tekst met hoofdstuk- en opdrachtnummers.
        </p>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
          <Icon name="upload" size={24} />
        </span>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">
            Klik of sleep een bestand hierheen
          </p>
          <p className="mt-0.5 text-xs text-slate-400">PDF, JPG, PNG, etc.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.doc,.docx"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {status === "uploading" && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
          Bestand uploaden...
        </div>
      )}

      {status === "verwerken" && (
        <div className="flex flex-col gap-2 rounded-xl bg-blue-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            AI leest het bestand...
          </div>
          <p className="text-xs text-blue-600">
            Dit kan even duren, vooral bij grote PDF&apos;s. De AI haalt de tekst,
            hoofdstuknummers en opdrachten eruit.
          </p>
        </div>
      )}

      {status === "klaar" && result && (
        <div className="flex flex-col gap-2 rounded-xl bg-emerald-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <Icon name="check" size={16} />
            Verwerkt: {result.title}
          </div>
          {(result.chapter || result.assignment) && (
            <p className="text-xs text-emerald-600">
              {result.chapter}
              {result.chapter && result.assignment ? " · " : ""}
              {result.assignment}
            </p>
          )}
          {result.contentPreview && (
            <p className="line-clamp-2 text-xs text-slate-500">{result.contentPreview}...</p>
          )}
          <button
            onClick={() => {
              setStatus("idle");
              setResult(null);
            }}
            className="mt-1 text-left text-xs font-medium text-blue-600 hover:underline"
          >
            Nog een bestand uploaden
          </button>
        </div>
      )}

      {status === "fout" && error && (
        <div className="flex flex-col gap-2 rounded-xl bg-rose-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-rose-700">
            <Icon name="alert-circle" size={16} />
            Mislukt
          </div>
          <p className="text-xs text-rose-600">{error}</p>
          <button
            onClick={() => {
              setStatus("idle");
              setError(null);
            }}
            className="mt-1 text-left text-xs font-medium text-blue-600 hover:underline"
          >
            Opnieuw proberen
          </button>
        </div>
      )}
    </Card>
  );
}
