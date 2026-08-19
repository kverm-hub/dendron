import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";

const MAX_KENNISBANK_TEKENS = 60000;
const MAX_GESCHIEDENIS = 20;

interface KennisbankEntry {
  title: string;
  chapter: string | null;
  assignment: string | null;
  content: string;
  source_type: string;
}

function bouwKennisbankTekst(entries: KennisbankEntry[]): string {
  return entries
    .map((m) => {
      let header = m.title;
      if (m.chapter) header += ` [${m.chapter}]`;
      if (m.assignment) header += ` [${m.assignment}]`;
      return `### ${header}\n${m.content}`;
    })
    .join("\n\n---\n\n");
}

function bouwSysteemPrompt(
  subjectName: string,
  aiInstructions: string,
  kennisbank: string,
  hoofdstukIndex: string | null
) {
  let prompt = `Je bent een persoonlijke, geduldige vakdocent/coach voor het vak "${subjectName}", voor een leerling in de tweede klas van het Havo.

Jouw belangrijkste doel is de leerling te helpen ZELF te leren en begrijpen - niet om meteen het kant-en-klare antwoord te geven. Werk zo:
- Stel eerst een korte, gerichte vraag terug of geef een hint, zodat de leerling zelf een stap kan zetten.
- Bouw in kleine stapjes op, controleer of iets begrepen is voordat je verdergaat.
- Geef pas een volledig antwoord of de uitleg in een keer als de leerling er na een paar hints echt niet uitkomt, of als er expliciet om gevraagd wordt ("geef me gewoon het antwoord").
- Wees kort, vriendelijk en bemoedigend. Dit is een chatgesprek, geen collegetekst.
- Als de leerling verwijst naar een hoofdstuk of opdracht, gebruik dan de juiste sectie uit de lesstof hieronder.

Blijf inhoudelijk dicht bij de lesstof van dit vak hieronder - dat is wat er op school behandeld wordt. Ga niet breeduit op andere onderwerpen in, tenzij de leerling daar zelf expliciet naar vraagt.
${aiInstructions ? `\nExtra instructies van de ouder/docent: ${aiInstructions}\n` : ""}`;

  if (hoofdstukIndex) {
    prompt += `\nOVERZICHT VAN BESCHIKBARE LESSTOF (gebruik dit om de juiste sectie te vinden):\n${hoofdstukIndex}\n`;
  }

  prompt += `\nAntwoord altijd in het Nederlands.

LESSTOF VOOR DIT VAK:
${kennisbank || "(nog geen lesstof toegevoegd - vertel de leerling dat je nog geen specifieke lesstof hebt en help voorlopig algemeen, maar vraag of ze het onderwerp kunnen noemen.)"}`;

  return prompt;
}

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "De AI-vakdocent is nog niet geconfigureerd (GEMINI_API_KEY ontbreekt)." },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });

  const { subjectId, message } = await request.json();
  if (!subjectId || !message || typeof message !== "string") {
    return NextResponse.json({ error: "subjectId en message zijn verplicht." }, { status: 400 });
  }

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name, ai_instructions, family_id")
    .eq("id", subjectId)
    .single();
  if (!subject) return NextResponse.json({ error: "Vak niet gevonden." }, { status: 404 });

  // Haal alle materials op met gestructureerde metadata
  const { data: materials } = await supabase
    .from("materials")
    .select("title, content, chapter, assignment, source_type")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: true });

  const entries: KennisbankEntry[] = (materials ?? []).map((m) => ({
    title: m.title,
    chapter: m.chapter,
    assignment: m.assignment,
    content: m.content,
    source_type: m.source_type,
  }));

  // Bouw een hoofdstukindex voor snelle navigatie bij grote kennisbanken
  let hoofdstukIndex: string | null = null;
  if (entries.length > 5) {
    const indexLines = entries.map((m) => {
      const loc = [m.chapter, m.assignment].filter(Boolean).join(" · ");
      return `- ${m.title}${loc ? ` (${loc})` : ""}`;
    });
    hoofdstukIndex = indexLines.join("\n");
  }

  // Bouw de kennisbank-tekst, met slim inkorten als het te groot wordt
  let kennisbank = bouwKennisbankTekst(entries);
  if (kennisbank.length > MAX_KENNISBANK_TEKENS) {
    // Als de kennisbank te groot is, behoud de eerste entries volledig en vat de rest samen
    const fullEntries: KennisbankEntry[] = [];
    let tekenTellerteller = 0;

    for (const entry of entries) {
      const entryTekst = `### ${entry.title}\n${entry.content}`;
      if (tekenTellerteller + entryTekst.length > MAX_KENNISBANK_TEKENS * 0.7) break;
      fullEntries.push(entry);
      tekenTellerteller += entryTekst.length;
    }

    const overgebleven = entries.slice(fullEntries.length);
    if (overgebleven.length > 0) {
      const samenvatting = overgebleven
        .map((m) => `- ${m.title}${m.chapter ? ` [${m.chapter}]` : ""}: ${m.content.slice(0, 200)}...`)
        .join("\n");
      kennisbank =
        bouwKennisbankTekst(fullEntries) +
        `\n\n---\n\nOVERIGE LESSTOF (samengevat):\n${samenvatting}`;
    } else {
      kennisbank = bouwKennisbankTekst(fullEntries);
    }
  }

  const { data: geschiedenis } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("subject_id", subjectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_GESCHIEDENIS);

  const historyVoorGemini = (geschiedenis ?? [])
    .slice()
    .reverse()
    .map((m) => ({ role: m.role, parts: [{ text: m.content }] }));

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    systemInstruction: bouwSysteemPrompt(
      subject.name,
      subject.ai_instructions ?? "",
      kennisbank,
      hoofdstukIndex
    ),
  });

  let antwoord: string;
  try {
    const chat = model.startChat({ history: historyVoorGemini });
    const result = await chat.sendMessage(message);
    antwoord = result.response.text();
  } catch {
    return NextResponse.json(
      { error: "De AI-vakdocent reageert nu niet. Probeer het straks nog eens." },
      { status: 502 }
    );
  }

  await supabase.from("chat_messages").insert([
    { family_id: subject.family_id, subject_id: subjectId, user_id: user.id, role: "user", content: message },
    { family_id: subject.family_id, subject_id: subjectId, user_id: user.id, role: "model", content: antwoord },
  ]);

  return NextResponse.json({ reply: antwoord });
}
