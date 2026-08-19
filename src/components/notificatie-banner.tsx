import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import type { PlanningItem } from "@/lib/types";

interface Notificatie {
  type: "voorstel" | "te-laat" | "toets-nabij" | "info";
  tekst: string;
  link?: string;
  icoon: string;
  kleur: string;
}

export function NotificatieBanner({ items }: { items: PlanningItem[] }) {
  const vandaag = new Date().toISOString().slice(0, 10);
  const over3Dagen = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const notificaties: Notificatie[] = [];

  const voorstellen = items.filter((i) => i.status === "voorstel");
  if (voorstellen.length > 0) {
    notificaties.push({
      type: "voorstel",
      tekst: `${voorstellen.length} leermoment${voorstellen.length > 1 ? "en" : ""} wacht${voorstellen.length > 1 ? "en" : ""} op je akkoord`,
      link: "/kind/agenda",
      icoon: "brain",
      kleur: "amber",
    });
  }

  const teLaat = items.filter(
    (i) => i.status !== "klaar" && i.status !== "voorstel" && i.due_date < vandaag
  );
  if (teLaat.length > 0) {
    notificaties.push({
      type: "te-laat",
      tekst: `${teLaat.length} item${teLaat.length > 1 ? "s" : ""} staat${teLaat.length > 1 ? "en" : ""} te laat`,
      link: "/kind/agenda",
      icoon: "alert-circle",
      kleur: "rose",
    });
  }

  const toetsNabij = items.filter(
    (i) => i.type === "toets" && i.status !== "klaar" && i.due_date >= vandaag && i.due_date <= over3Dagen
  );
  for (const toets of toetsNabij) {
    const dagenNog = Math.ceil(
      (new Date(toets.due_date + "T00:00:00").getTime() - new Date(vandaag + "T00:00:00").getTime()) / 86400000
    );
    notificaties.push({
      type: "toets-nabij",
      tekst: `Toets "${toets.title}" ${dagenNog === 0 ? "vandaag!" : dagenNog === 1 ? "morgen!" : `over ${dagenNog} dagen`}`,
      link: "/kind/agenda",
      icoon: "alert-circle",
      kleur: "rose",
    });
  }

  if (notificaties.length === 0) return null;

  const kleurClasses: Record<string, string> = {
    rose: "border-rose-100 bg-rose-50/60",
    amber: "border-amber-100 bg-amber-50/60",
  };
  const icoonClasses: Record<string, string> = {
    rose: "text-rose-600",
    amber: "text-amber-600",
  };

  return (
    <div className="flex flex-col gap-2">
      {notificaties.map((n, i) => {
        const inhoud = (
          <Card className={`flex items-center gap-3 ${kleurClasses[n.kleur]}`}>
            <Icon name={n.icoon} size={20} className={icoonClasses[n.kleur]} />
            <p className={`text-sm font-medium ${n.kleur === "rose" ? "text-rose-800" : "text-amber-800"}`}>
              {n.tekst}
            </p>
          </Card>
        );
        if (n.link) {
          return (
            <Link key={i} href={n.link}>
              {inhoud}
            </Link>
          );
        }
        return <div key={i}>{inhoud}</div>;
      })}
    </div>
  );
}
