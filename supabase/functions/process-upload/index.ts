import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.24.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessRequest {
  filePath: string;
  fileType: string;
  fileName: string;
  subjectId: string;
  familyId: string;
}

interface ExtractedContent {
  title: string;
  chapter: string | null;
  assignment: string | null;
  content: string;
  imageUrls: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuratie ontbreekt." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "AI-service niet geconfigureerd (GEMINI_API_KEY ontbreekt)." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { filePath, fileType, fileName, subjectId, familyId } = await req.json() as ProcessRequest;

    if (!filePath || !fileType || !subjectId || !familyId) {
      return new Response(JSON.stringify({ error: "filePath, fileType, subjectId en familyId zijn verplicht." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("lesstof")
      .download(filePath);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: "Bestand kon niet worden opgehaald uit storage." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash",
      systemInstruction: `Je bent een assistent die lesmateriaal voor Nederlandse middelbare scholieren (Havo) verwerkt tot een gestructureerde kennisbank.

Je krijgt een bestand (PDF of afbeelding) met lesstof. Jouw taak:
1. Lees de inhoud zorgvuldig door.
2. Identificeer het hoofdstuknummer en/of opdrachtnummer als die in het materiaal staan.
3. Vat de inhoud samen tot duidelijke, gestructureerde tekst die een AI-tutor kan gebruiken om een leerling te helpen.
4. Behoud belangrijke definities, formules, voorbeelden en uitleg.
5. Als er afbeeldingen/diagrammen in staan die belangrijk zijn voor de uitleg, beschrijf deze dan kort.

Geef je antwoord als JSON met deze structuur:
{
  "title": "korte titel van het materiaal",
  "chapter": "Hoofdstuk X" of null,
  "assignment": "Opdracht Y" of null,
  "content": "de gestructureerde samenvatting van de lesstof",
  "hasImages": true/false
}

Antwoord ALLEEN met geldige JSON, geen andere tekst.`,
    });

    let extracted: ExtractedContent;

    const isImage = fileType.startsWith("image/");
    const isPdf = fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

    if (isImage) {
      // Use vision model for images
      const visionModel = genAI.getGenerativeModel({
        model: Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash",
        systemInstruction: `Je bent een assistent die afbeeldingen van lesmateriaal voor Nederlandse middelbare scholieren (Havo) omzet naar gestructureerde tekst.

Lees de afbeelding (kan een foto zijn van een tekstboek, werkblad, of schermafbeelding) en extraherr:
1. Alle tekst die zichtbaar is.
2. Hoofdstuk- en opdrachtnummers als die vermeld worden.
3. Beschrijvingen van diagrammen of afbeeldingen die belangrijk zijn voor begrip.

Geef je antwoord als JSON:
{
  "title": "korte titel",
  "chapter": "Hoofdstuk X" of null,
  "assignment": "Opdracht Y" of null,
  "content": "volledige geëxtraheerde en gestructureerde tekst",
  "hasImages": true/false
}

Antwoord ALLEEN met geldige JSON.`,
      });

      const base64 = btoa(String.fromCharCode(...bytes));
      const mimeType = fileType;

      const result = await visionModel.generateContent([
        {
          inlineData: { data: base64, mimeType },
        },
        "Verwerk deze afbeelding tot gestructureerde kennisbank-tekst. Geef alleen JSON terug.",
      ]);

      const text = result.response.text();
      const jsonStr = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      // Store the image itself in storage for reuse in tutoring
      const imageStoragePath = `${familyId}/images/${Date.now()}-${fileName}`;
      const { error: imageUploadError } = await supabase.storage
        .from("lesstof")
        .upload(imageStoragePath, bytes, { contentType: fileType });

      let imageUrl: string | null = null;
      if (!imageUploadError) {
        const { data: urlData } = supabase.storage
          .from("lesstof")
          .getPublicUrl(imageStoragePath);
        imageUrl = urlData.publicUrl;
      }

      extracted = {
        title: parsed.title || fileName,
        chapter: parsed.chapter || null,
        assignment: parsed.assignment || null,
        content: parsed.content || "",
        imageUrls: imageUrl ? [imageUrl] : [],
      };
    } else if (isPdf) {
      // For PDFs, use the text extraction approach
      const base64 = btoa(String.fromCharCode(...bytes));

      const result = await model.generateContent([
        {
          inlineData: { data: base64, mimeType: "application/pdf" },
        },
        "Verwerk dit PDF-bestand tot gestructureerde kennisbank-tekst. Geef alleen JSON terug.",
      ]);

      const text = result.response.text();
      const jsonStr = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      extracted = {
        title: parsed.title || fileName,
        chapter: parsed.chapter || null,
        assignment: parsed.assignment || null,
        content: parsed.content || "",
        imageUrls: [],
      };
    } else {
      // Text-based files: treat as plain text
      const textContent = new TextDecoder().decode(bytes);

      const result = await model.generateContent(
        `Verwerk de volgende tekst tot gestructureerde kennisbank-tekst. Geef alleen JSON terug.\n\n${textContent.slice(0, 50000)}`
      );

      const text = result.response.text();
      const jsonStr = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      extracted = {
        title: parsed.title || fileName,
        chapter: parsed.chapter || null,
        assignment: parsed.assignment || null,
        content: parsed.content || "",
        imageUrls: [],
      };
    }

    // Insert processed material into database
    const { data: material, error: insertError } = await supabase
      .from("materials")
      .insert({
        family_id: familyId,
        subject_id: subjectId,
        title: extracted.title,
        content: extracted.content,
        source_type: isImage ? "afbeelding" : isPdf ? "pdf" : "tekst",
        chapter: extracted.chapter,
        assignment: extracted.assignment,
        image_urls: extracted.imageUrls,
        original_file_url: null,
        processing_status: "verwerkt",
        uploaded_by: null as unknown as string,
        uploaded_by_role: "ouder",
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: "Kon verwerkt materiaal niet opslaan: " + insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean up original file from storage (we've extracted what we need)
    // But keep it for reference — don't delete

    return new Response(JSON.stringify({
      success: true,
      materialId: material?.id,
      title: extracted.title,
      chapter: extracted.chapter,
      assignment: extracted.assignment,
      contentPreview: extracted.content.slice(0, 200),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout bij verwerken upload.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
