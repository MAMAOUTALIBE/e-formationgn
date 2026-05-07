import { z } from "zod";

export const promoCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Code trop court.")
      .max(40, "Code trop long.")
      .regex(/^[A-Za-z0-9_-]+$/, "Code invalide."),
  })
  .strict();

export const setCurrencySchema = z
  .object({
    currency: z.enum(["EUR", "USD"]),
  })
  .strict();
