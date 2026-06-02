import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getAllDestinations,
  getDestinationById,
  createDestination,
  updateDestination,
  deleteDestination,
  getUserByOpenId,
  getSetting,
  setSetting,
  upsertUser,
} from "./db";
import {
  runScan,
  getTodayDeals,
  getPriceHistory,
  getFullScanHistory,
  getLatestScanForDestination,
  getRecentScanRuns,
  getAvailableOrigins,
} from "./scanner";
import { checkAmadeusConnection } from "./amadeus";
import { sdk } from "./_core/sdk";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const configuredEmail = process.env.LOCAL_LOGIN_EMAIL?.trim().toLowerCase();
        const configuredPassword = process.env.LOCAL_LOGIN_PASSWORD ?? "";
        const email = input.email.trim().toLowerCase();

        if (!configuredEmail || !configuredPassword) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Local login is not configured",
          });
        }

        if (email !== configuredEmail || input.password !== configuredPassword) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        const openId = `local:${email}`;
        const name = email.split("@")[0] || "Local Admin";

        await upsertUser({
          openId,
          name,
          email,
          loginMethod: "local",
          role: "admin",
          lastSignedIn: new Date(),
        });

        const sessionToken = await sdk.createSessionToken(openId, {
          name,
          email,
          loginMethod: "local",
        });

        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: ONE_YEAR_MS,
        });

        const user = await getUserByOpenId(openId);

        return {
          success: true,
          user: user ?? {
            id: 0,
            openId,
            name,
            email,
            loginMethod: "local",
            role: "admin" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
          },
        };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  destinations: router({
    list: publicProcedure.query(async () => getAllDestinations()),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const dest = await getDestinationById(input.id);
        if (!dest) throw new TRPCError({ code: "NOT_FOUND" });
        return dest;
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        iataCode: z.string().length(3),
        country: z.string().max(60).optional().default(""),
        continent: z.string().max(30).optional().default(""),
        region: z.string().min(1).max(50),
        bookingWindowDays: z.number().int().min(7).max(365),
        defaultTripDays: z.number().int().min(1).max(60),
        isActive: z.boolean().optional().default(true),
      }))
      .mutation(async ({ input }) => {
        const id = await createDestination({ ...input, iataCode: input.iataCode.toUpperCase() });
        return { id };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        iataCode: z.string().length(3).optional(),
        country: z.string().max(60).optional(),
        continent: z.string().max(30).optional(),
        region: z.string().min(1).max(50).optional(),
        bookingWindowDays: z.number().int().min(7).max(365).optional(),
        defaultTripDays: z.number().int().min(1).max(60).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateDestination(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteDestination(input.id);
        return { success: true };
      }),
  }),

  scans: router({
    todayDeals: publicProcedure
      .input(z.object({ origin: z.string().optional() }).optional())
      .query(async ({ input }) => getTodayDeals(input?.origin)),

    priceHistory: publicProcedure
      .input(z.object({
        destinationId: z.number(),
        days: z.number().optional().default(30),
        origin: z.string().optional(),
      }))
      .query(async ({ input }) => getPriceHistory(input.destinationId, input.days, input.origin)),

    fullHistory: publicProcedure
      .input(z.object({
        destinationId: z.number(),
        origin: z.string().optional(),
      }))
      .query(async ({ input }) => getFullScanHistory(input.destinationId, input.origin)),

    latestForDestination: publicProcedure
      .input(z.object({ destinationId: z.number() }))
      .query(async ({ input }) => getLatestScanForDestination(input.destinationId)),

    availableOrigins: publicProcedure.query(async () => getAvailableOrigins()),

    recentRuns: adminProcedure.query(async () => getRecentScanRuns(10)),

    triggerScan: adminProcedure.mutation(async () => {
      try {
        const result = await runScan("manual");
        return { success: true, ...result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
  }),

  settings: router({
    get: adminProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => getSetting(input.key)),

    set: adminProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input }) => {
        await setSetting(input.key, input.value);
        return { success: true };
      }),

    notificationPrefs: adminProcedure.query(async () => {
      const [threshold, enabled, origins] = await Promise.all([
        getSetting("notification.hotDealThreshold"),
        getSetting("notification.enabled"),
        getSetting("scan.origins"),
      ]);
      return {
        hotDealThreshold: threshold ? parseFloat(threshold) : -15,
        enabled: enabled !== "false",
        origins: origins ?? "SYD",
      };
    }),

    saveNotificationPrefs: adminProcedure
      .input(z.object({
        hotDealThreshold: z.number().min(-50).max(-1),
        enabled: z.boolean(),
        origins: z.string().min(3),
      }))
      .mutation(async ({ input }) => {
        await Promise.all([
          setSetting("notification.hotDealThreshold", String(input.hotDealThreshold)),
          setSetting("notification.enabled", String(input.enabled)),
          setSetting("scan.origins", input.origins.toUpperCase()),
        ]);
        return { success: true };
      }),

    checkConnections: adminProcedure.query(async () => {
      const [amadeusOk, openaiOk] = await Promise.all([
        checkAmadeusConnection(),
        checkOpenAIConnection(),
      ]);
      return {
        amadeus: amadeusOk,
        openai: openaiOk,
        amadeusConfigured: !!(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET),
        openaiConfigured: !!process.env.OPENAI_API_KEY,
        amadeusEnv: process.env.AMADEUS_ENV === "production" ? "production" : "test",
      };
    }),
  }),

  ai: router({
    chat: publicProcedure
      .input(z.object({
        destinationId: z.number(),
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().max(2000),
        })).max(20),
      }))
      .mutation(async ({ input }) => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AI not configured" });

        const dest = await getDestinationById(input.destinationId);
        if (!dest) throw new TRPCError({ code: "NOT_FOUND" });
        const latestScan = await getLatestScanForDestination(input.destinationId);

        const contextLines: string[] = [
          `Destination: ${dest.name} (${dest.iataCode})`,
          `Country: ${dest.country}, Region: ${dest.region}, Continent: ${dest.continent}`,
          `Default trip: ${dest.defaultTripDays} days, Booking window: ${dest.bookingWindowDays} days ahead`,
        ];
        if (latestScan) {
          const price = parseFloat(String(latestScan.price));
          const avg = latestScan.thirtyDayAvg ? parseFloat(String(latestScan.thirtyDayAvg)) : null;
          const pct = latestScan.percentVsAvg ? parseFloat(String(latestScan.percentVsAvg)) : null;
          contextLines.push(
            `Current best fare: $${Math.round(price)} ${latestScan.currency} return from ${latestScan.origin ?? "SYD"}`,
            `Deal rating: ${latestScan.dealRating}`,
            `Airline: ${latestScan.airline ?? latestScan.airlineCode ?? "Unknown"}, Stops: ${latestScan.stops === 0 ? "Direct" : latestScan.stops + " stop(s)"}`,
            `Departure: ${latestScan.departureDate}, Return: ${latestScan.returnDate}`,
            ...(avg ? [`30-day avg: $${Math.round(avg)} ${latestScan.currency}`] : []),
            ...(pct !== null ? [`vs average: ${pct.toFixed(1)}%`] : []),
            ...(latestScan.aiTravelTip ? [`AI tip: ${latestScan.aiTravelTip}`] : []),
          );
        }

        const systemPrompt = `You are a knowledgeable flight deal assistant for Australian travellers. Be concise, friendly, and practical. Answer questions about this specific destination and flight deal.

Current deal context:
${contextLines.join("\n")}

Answer questions about visas, best time to visit, what to do, local tips, whether this is a good deal, packing, etc. Keep answers under 200 words.`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, ...input.messages],
            max_tokens: 500,
          }),
        });

        if (!response.ok) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI request failed" });
        }

        const data = await response.json() as { choices: Array<{ message: { content: string } }> };
        return { response: data.choices[0]?.message?.content ?? "" };
      }),
  }),
});

async function checkOpenAIConnection(): Promise<boolean> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return false;
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type AppRouter = typeof appRouter;
