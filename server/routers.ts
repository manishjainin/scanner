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
  getLatestScanForDestination,
  getRecentScanRuns,
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
    todayDeals: publicProcedure.query(async () => getTodayDeals()),

    priceHistory: publicProcedure
      .input(z.object({ destinationId: z.number() }))
      .query(async ({ input }) => getPriceHistory(input.destinationId)),

    latestForDestination: publicProcedure
      .input(z.object({ destinationId: z.number() }))
      .query(async ({ input }) => getLatestScanForDestination(input.destinationId)),

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
