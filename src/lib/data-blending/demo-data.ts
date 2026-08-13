import { subDays, format } from "date-fns";
import type { Ga4Row, GscRow } from "./attribution";

/** Generic sample dataset so the UI can run without Google credentials. */
export function getDemoSourceRows(days = 30): { gsc: GscRow[]; ga4: Ga4Row[] } {
  const keywords = [
    { q: "project management software", page: "/", clicks: 18, impressions: 620, device: "DESKTOP", country: "US" },
    { q: "best project tracker", page: "/", clicks: 12, impressions: 340, device: "MOBILE", country: "US" },
    { q: "team task app", page: "/features", clicks: 9, impressions: 210, device: "DESKTOP", country: "GB" },
    { q: "kanban board tool", page: "/features", clicks: 7, impressions: 190, device: "MOBILE", country: "US" },
    { q: "pricing project management", page: "/pricing", clicks: 14, impressions: 480, device: "DESKTOP", country: "US" },
    { q: "free project management", page: "/pricing", clicks: 8, impressions: 220, device: "MOBILE", country: "CA" },
    { q: "project management blog", page: "/blog", clicks: 6, impressions: 150, device: "DESKTOP", country: "US" },
    { q: "how to run sprints", page: "/blog/sprints", clicks: 5, impressions: 130, device: "MOBILE", country: "AU" },
    { q: "contact sales software", page: "/contact", clicks: 4, impressions: 95, device: "DESKTOP", country: "US" },
    { q: "workflow software", page: "/features", clicks: 11, impressions: 390, device: "DESKTOP", country: "US" },
    { q: "workflow software for teams", page: "/features", clicks: 9, impressions: 260, device: "MOBILE", country: "US" },
    { q: "workflow software comparison", page: "/features", clicks: 6, impressions: 140, device: "MOBILE", country: "GB" },
    { q: "best workflow software", page: "/features", clicks: 4, impressions: 95, device: "DESKTOP", country: "US" },
    { q: "workflow software demo", page: "/features", clicks: 5, impressions: 120, device: "TABLET", country: "US" },
  ];

  const events = ["generate_lead", "sign_up", "form_submit", "contact"];
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
        const clusterBoost = kw.page === "/features" && hour === "14" ? 1.8 : 1;
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
          page: `https://example.com${kw.page}`,
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
                ? page === "/" || page === "/features"
                  ? 2
                  : 1
                : 0
              : seed % 7 === 0
                ? 1
                : 0;
          if (page === "/features" && hour === "14" && eventName === "generate_lead") {
            conversions = Math.max(conversions, 3);
          }
          if (page === "/features" && hour === "14" && eventName === "sign_up") {
            conversions = Math.max(conversions, 1);
          }
          if (!conversions) continue;

          const device =
            page === "/features"
              ? seed % 2 === 0
                ? "DESKTOP"
                : "MOBILE"
              : seed % 3 === 0
                ? "MOBILE"
                : "DESKTOP";

          let conversionPage = page;
          if (eventName === "generate_lead" || eventName === "form_submit") {
            conversionPage = "/thank-you";
          } else if (eventName === "sign_up" || eventName === "contact") {
            conversionPage = "/contact";
          }

          ga4.push({
            date,
            hour,
            landingPage: page,
            conversionPage,
            eventName,
            device,
            country: "US",
            sessions: 1 + (i % 3) + (page === "/features" && hour === "14" ? 4 : 0),
            eventCount: conversions,
            conversions,
            eventValue: conversions * (eventName === "generate_lead" ? 120 : 40),
            channelGroup: "Organic Search",
            isKeyEvent: true,
          });
        }

        // Organic Search user traffic for this landing × hour (not only converting events)
        ga4.push({
          date,
          hour,
          landingPage: page,
          conversionPage: page,
          eventName: "page_view",
          device: "DESKTOP",
          country: "US",
          sessions: 8 + (i % 4),
          eventCount: 12 + (i % 5),
          conversions: 0,
          eventValue: 0,
          channelGroup: "Organic Search",
          isKeyEvent: false,
        });
        ga4.push({
          date,
          hour,
          landingPage: page,
          conversionPage: page,
          eventName: "session_start",
          device: "MOBILE",
          country: "US",
          sessions: 5 + (i % 3) + (page === "/features" && hour === "14" ? 4 : 0),
          eventCount: 5 + (i % 3),
          conversions: 0,
          eventValue: 0,
          channelGroup: "Organic Search",
          isKeyEvent: false,
        });
      }
    }
  }

  return { gsc, ga4 };
}
