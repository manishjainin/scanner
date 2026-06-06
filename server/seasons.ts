/**
 * AI-generated "best time to visit" months per destination.
 * Stored on destinations.bestMonths as an array of month numbers (1-12).
 * Admin can override via Settings (sets bestMonthsSource = 'manual').
 */

import { eq, isNull, or } from "drizzle-orm";
import { getDb } from "./db";
import { destinations } from "../drizzle/schema";

/** Ask the LLM for the ideal months to visit a destination. Returns [] on failure. */
export async function generateBestMonths(destinationName: string, country: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const prompt = `For a leisure traveller, what are the best months to visit ${destinationName}, ${country}?
Consider weather, peak experiences, and avoiding extreme heat/cold/monsoon. Return the ideal months only.

Respond with JSON: { "months": [<month numbers 1-12>], "reason": "<one short sentence>" }
List 2-6 months. Example for a destination best in spring/autumn: { "months": [4,5,9,10], "reason": "Mild temperatures and fewer crowds." }`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "best_months",
            strict: true,
            schema: {
              type: "object",
              properties: {
                months: { type: "array", items: { type: "integer" } },
                reason: { type: "string" },
              },
              required: ["months", "reason"],
              additionalProperties: false,
            },
          },
        },
        max_tokens: 150,
      }),
    });
    if (!response.ok) return [];
    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content) as { months: number[] };
    // Sanitise: unique ints in 1-12
    return Array.from(new Set(parsed.months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))).sort((a, b) => a - b);
  } catch (err) {
    console.error(`[Seasons] Failed for ${destinationName}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Fill bestMonths for destinations that don't have it yet (AI source only).
 * Set force=true to refresh all AI-sourced destinations (skips manual overrides).
 */
export async function refreshBestSeasons(force = false): Promise<{ updated: number }> {
  const db = await getDb();
  if (!db) return { updated: 0 };

  const rows = force
    ? await db.select().from(destinations).where(eq(destinations.bestMonthsSource, "ai"))
    : await db.select().from(destinations).where(or(isNull(destinations.bestMonths), eq(destinations.bestMonthsSource, "ai")));

  let updated = 0;
  for (const dest of rows) {
    // Skip manual overrides, and (when not forcing) those already populated
    if (dest.bestMonthsSource === "manual") continue;
    if (!force && dest.bestMonths && dest.bestMonths.length > 0) continue;

    const months = await generateBestMonths(dest.name, dest.country);
    if (months.length > 0) {
      await db.update(destinations).set({ bestMonths: months, bestMonthsSource: "ai" }).where(eq(destinations.id, dest.id));
      updated++;
    }
  }
  console.log(`[Seasons] Refreshed best months for ${updated} destinations`);
  return { updated };
}
