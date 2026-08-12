import { subDays, format } from "date-fns";
import type { Ga4Row, GscRow } from "./attribution";

/** Deterministic demo dataset shaped like Creative Kitchen & Stone traffic */
export function getDemoSourceRows(days = 30): { gsc: GscRow[]; ga4: Ga4Row[] } {
  const keywords = [
    { q: "creative kitchens taupo", page: "/", clicks: 12, impressions: 340, device: "MOBILE", country: "NZL" },
    { q: "kitchen renovation taupo", page: "/kitchen-renovation", clicks: 9, impressions: 210, device: "DESKTOP", country: "NZL" },
    { q: "kitchen benchtops", page: "/kitchen/stone-benchtops", clicks: 14, impressions: 480, device: "MOBILE", country: "NZL" },
    { q: "stone benchtop taupo", page: "/kitchen/stone-benchtops", clicks: 7, impressions: 190, device: "DESKTOP", country: "NZL" },
    { q: "gfrc benchtops", page: "/stone/glass-fibre-reinforced-concrete", clicks: 5, impressions: 88, device: "DESKTOP", country: "NZL" },
    { q: "kitchen splashbacks", page: "/kitchen/kitchen-splashbacks", clicks: 6, impressions: 150, device: "MOBILE", country: "AUS" },
    { q: "custom kitchen cabinets", page: "/joinery/kitchen-cabinet", clicks: 8, impressions: 220, device: "DESKTOP", country: "NZL" },
    { q: "bathroom vanities taupo", page: "/bathroom-vanities", clicks: 4, impressions: 95, device: "MOBILE", country: "NZL" },
    { q: "kitchen design hawkes bay", page: "/kitchen/kitchen-hawkes-bay", clicks: 5, impressions: 130, device: "DESKTOP", country: "NZL" },
    { q: "creative kitchens", page: "/", clicks: 18, impressions: 620, device: "DESKTOP", country: "NZL" },
    // Crowded same-page cluster (your example) — share one hour window
    { q: "kitchen design", page: "/kitchen-design", clicks: 11, impressions: 390, device: "DESKTOP", country: "NZL" },
    { q: "kitchen design taupo", page: "/kitchen-design", clicks: 9, impressions: 260, device: "MOBILE", country: "NZL" },
    { q: "kitchen design taupo nz", page: "/kitchen-design", clicks: 6, impressions: 140, device: "MOBILE", country: "NZL" },
    { q: "best kitchen design taupo", page: "/kitchen-design", clicks: 4, impressions: 95, device: "DESKTOP", country: "NZL" },
    { q: "kitchen design service", page: "/kitchen-design", clicks: 5, impressions: 120, device: "TABLET", country: "NZL" },
  ];

  const events = ["generate_lead", "phone_call_click", "form_submit", "contact"];
  const hours = ["08", "10", "12", "14", "16", "18", "20"];

  const gsc: GscRow[] = [];
  const ga4: Ga4Row[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(today, i), "yyyy-MM-dd");
    const dayFactor = 0.7 + ((i * 17) % 10) / 20;

    for (const kw of keywords) {
      for (const hour of hours) {
        const hourFactor = 0.35 + (Number(hour) % 7) * 0.08;
        // Amplify crowded kitchen-design cluster at 14:00 so mapping UI has clear examples
        const clusterBoost =
          kw.page === "/kitchen-design" && hour === "14" ? 1.8 : 1;
        const clicks = Math.max(
          0,
          Math.round(
            kw.clicks * dayFactor * hourFactor * clusterBoost * (0.25 + (i % 5) * 0.08),
          ),
        );
        if (!clicks) continue;
        const impressions = Math.max(
          clicks,
          Math.round(kw.impressions * dayFactor * hourFactor * clusterBoost * 0.2),
        );
        gsc.push({
          date,
          hour,
          query: kw.q,
          page: `https://creativekitchensandstone.co.nz${kw.page}/`,
          device: kw.device,
          country: kw.country,
          clicks,
          impressions,
          ctr: impressions ? clicks / impressions : 0,
          position: 4 + (i % 8) * 0.4,
        });
      }
    }

    const pages = [...new Set(keywords.map((k) => k.page))];
    for (const page of pages) {
      for (const hour of hours) {
        for (const eventName of events) {
          const seed = i + eventName.length + page.length + Number(hour);
          let conversions =
            eventName === "generate_lead"
              ? seed % 5 === 0
                ? page === "/" || page === "/kitchen-design"
                  ? 2
                  : 1
                : 0
              : seed % 7 === 0
                ? 1
                : 0;
          // Force shared key events on kitchen-design @ 14:00 for mapping demos
          if (page === "/kitchen-design" && hour === "14" && eventName === "generate_lead") {
            conversions = Math.max(conversions, 3);
          }
          if (page === "/kitchen-design" && hour === "14" && eventName === "phone_call_click") {
            conversions = Math.max(conversions, 1);
          }
          if (!conversions) continue;

          const device =
            page === "/kitchen-design"
              ? seed % 2 === 0
                ? "DESKTOP"
                : "MOBILE"
              : seed % 3 === 0
                ? "MOBILE"
                : "DESKTOP";

          // Multi-page journeys: land on service → convert on thank-you / contact
          let conversionPage = page;
          if (eventName === "generate_lead" || eventName === "form_submit") {
            conversionPage = "/thank-you";
          } else if (eventName === "phone_call_click" || eventName === "contact") {
            conversionPage = "/contact";
          }

          ga4.push({
            date,
            hour,
            landingPage: page,
            conversionPage,
            eventName,
            device,
            country: "NZL",
            sessions: 1 + (i % 3) + (page === "/kitchen-design" && hour === "14" ? 4 : 0),
            conversions,
            eventValue: conversions * (eventName === "generate_lead" ? 120 : 40),
            channelGroup: "Organic Search",
          });
        }
      }
    }
  }

  return { gsc, ga4 };
}
