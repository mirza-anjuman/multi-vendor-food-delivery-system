/**
 * AI Nutrition Provider and Estimation Service.
 *
 * Implements strict security, input sanitization, JSON schema enforcement,
 * plausibility clamping, and canonical dish caching.
 */
import crypto from "crypto";
import axios from "axios";
import { z } from "zod";
import MenuItemModel from "../../models/MenuItem";
import { NutritionEstimate, INutritionEstimate } from "../../models/NutritionEstimate";
import { normalizeDishName } from "../menu/dish-matcher.service";

export const NUTRITION_PROMPT_VERSION = "v1.0";

const rawNutritionSchema = z.object({
  servingSizeDescription: z.string().min(2).max(200),
  caloriesMin: z.number(),
  caloriesMax: z.number(),
  proteinGrams: z.number().optional(),
  carbsGrams: z.number().optional(),
  fatGrams: z.number().optional(),
});

export type ValidatedNutrition = {
  servingSizeDescription: string;
  caloriesMin: number;
  caloriesMax: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
};

export interface NutritionResult {
  enabled: boolean;
  source: "vendor" | "ai" | "none";
  label?: string;
  servingSize?: string;
  calories?: number;
  caloriesMin?: number;
  caloriesMax?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  status?: "ready" | "pending" | "failed";
}

/**
 * Computes deterministic hash of normalized inputs.
 */
export function computeInputHash(name: string, description: string, variant: string): string {
  const content = `${normalizeDishName(name)}|${description.trim().slice(0, 300)}|${variant.trim()}`;
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Validates and clamps raw JSON output from AI provider.
 */
export function validateAndClampNutrition(raw: unknown): ValidatedNutrition | null {
  const parsed = rawNutritionSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  const data = parsed.data;
  // Ensure caloriesMin <= caloriesMax
  let minCal = Math.min(data.caloriesMin, data.caloriesMax);
  let maxCal = Math.max(data.caloriesMin, data.caloriesMax);

  // Plausibility clamping
  minCal = Math.max(30, Math.min(Math.round(minCal), 3500));
  maxCal = Math.max(minCal, Math.min(Math.round(maxCal), 3500));

  const proteinGrams =
    data.proteinGrams !== undefined
      ? Math.max(0, Math.min(Math.round(data.proteinGrams), 300))
      : undefined;
  const carbsGrams =
    data.carbsGrams !== undefined
      ? Math.max(0, Math.min(Math.round(data.carbsGrams), 300))
      : undefined;
  const fatGrams =
    data.fatGrams !== undefined
      ? Math.max(0, Math.min(Math.round(data.fatGrams), 300))
      : undefined;

  return {
    servingSizeDescription: data.servingSizeDescription.trim().slice(0, 100),
    caloriesMin: minCal,
    caloriesMax: maxCal,
    proteinGrams,
    carbsGrams,
    fatGrams,
  };
}

/**
 * Core AI generation adapter using OpenAI-compatible chat completions.
 */
export async function generateNutritionEstimate(
  dishName: string,
  dishDescription: string,
  portion: string
): Promise<ValidatedNutrition | null> {
  const isEnabled = process.env.NUTRITION_AI_ENABLED === "true";
  if (!isEnabled) return null;

  const apiKey = process.env.NUTRITION_AI_API_KEY || process.env.OPENROUTER_API_KEY;
  const baseUrl = (
    process.env.NUTRITION_AI_BASE_URL || "https://openrouter.ai/api/v1"
  ).replace(/\/$/, "");
  const model =
    process.env.NUTRITION_AI_MODEL ||
    process.env.OPENROUTER_AI_MODEL ||
    "apodex/apodex-1.1-mini:free";
  const timeoutMs = parseInt(process.env.NUTRITION_AI_TIMEOUT_MS || "8000", 10);

  // Sanitize vendor-controlled text: cap lengths and treat as plain text data
  const safeName = dishName.trim().slice(0, 100);
  const safeDesc = dishDescription.trim().slice(0, 300);
  const safePortion = portion.trim().slice(0, 50);

  const prompt = `Analyze the nutritional profile for this food item:
Name: ${JSON.stringify(safeName)}
Description: ${JSON.stringify(safeDesc)}
Portion/Variant: ${JSON.stringify(safePortion)}

Provide an estimated calorie range and macro-nutrients per single standard serving.
Rules:
1. Output MUST be ONLY valid JSON matching this schema:
{
  "servingSizeDescription": "Short description of 1 serving (e.g. 1 burger (approx 220g))",
  "caloriesMin": 450,
  "caloriesMax": 550,
  "proteinGrams": 25,
  "carbsGrams": 40,
  "fatGrams": 22
}
2. Plausible ranges: calories between 30 and 3500.
3. NEVER make medical claims. NEVER include allergen information.`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a nutritional analysis assistant. You output strictly raw JSON with no markdown wrapping and no explanation.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 300,
        reasoning: { effort: "none" },
      },
      { headers, timeout: timeoutMs }
    );

    const rawContent = response.data?.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== "string") {
      return null;
    }

    // Clean JSON content if wrapped in markdown code blocks
    let cleaned = rawContent.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(cleaned);
    return validateAndClampNutrition(parsed);
  } catch (err: unknown) {
    // Non-blocking: fail quietly without leaking secrets
    return null;
  }
}

/**
 * Gets or enqueues nutrition estimate for a menu item.
 */
export async function getNutritionForItem(itemId: string): Promise<NutritionResult> {
  const item = await MenuItemModel.findById(itemId).lean();
  if (!item) {
    return { enabled: false, source: "none" };
  }

  // 1. Check if vendor supplied nutrition data
  if (
    item.nutritionInfo &&
    !item.nutritionInfo.isEstimated &&
    item.nutritionInfo.calories !== undefined
  ) {
    return {
      enabled: true,
      source: "vendor",
      label: "Provided by the restaurant",
      calories: item.nutritionInfo.calories,
      servingSize: item.nutritionInfo.servingSize || item.servingSize || "1 serving",
      proteinGrams: item.nutritionInfo.protein,
      carbsGrams: item.nutritionInfo.carbs,
      fatGrams: item.nutritionInfo.fat,
    };
  }

  // 2. Check if AI Nutrition is enabled in env
  const isAiEnabled = process.env.NUTRITION_AI_ENABLED === "true";
  if (!isAiEnabled) {
    return { enabled: false, source: "none" };
  }

  const normalizedName = normalizeDishName(item.name);
  const portion = item.variants?.[0]?.name || item.servingSize || "standard";
  const cacheKey = `${normalizedName}::${portion.toLowerCase()}`;
  const inputHash = computeInputHash(item.name, item.description || "", portion);

  // 3. Check MongoDB Cache
  const cached = await NutritionEstimate.findOne({ cacheKey });
  if (cached && cached.status === "ready") {
    // Check if input changed or prompt version changed
    if (
      cached.inputHash === inputHash &&
      cached.promptVersion === NUTRITION_PROMPT_VERSION
    ) {
      return {
        enabled: true,
        source: "ai",
        label: "AI estimate. Actual values vary by restaurant and portion.",
        servingSize: cached.servingSizeDescription,
        caloriesMin: cached.caloriesMin,
        caloriesMax: cached.caloriesMax,
        proteinGrams: cached.proteinGrams,
        carbsGrams: cached.carbsGrams,
        fatGrams: cached.fatGrams,
        status: "ready",
      };
    }
  }

  // 4. Return pending and generate asynchronously
  // Initiate async generation without blocking the HTTP request
  void (async () => {
    try {
      const generated = await generateNutritionEstimate(
        item.name,
        item.description || "",
        portion
      );

      if (generated) {
        await NutritionEstimate.findOneAndUpdate(
          { cacheKey },
          {
            cacheKey,
            normalizedName,
            portionDescriptor: portion,
            servingSizeDescription: generated.servingSizeDescription,
            caloriesMin: generated.caloriesMin,
            caloriesMax: generated.caloriesMax,
            proteinGrams: generated.proteinGrams,
            carbsGrams: generated.carbsGrams,
            fatGrams: generated.fatGrams,
            inputHash,
            promptVersion: NUTRITION_PROMPT_VERSION,
            aiModel: process.env.NUTRITION_AI_MODEL || "apodex/apodex-1.1-mini:free",
            status: "ready",
          },
          { upsert: true, new: true }
        );
      }
    } catch {
      // Silently fail async generation
    }
  })();

  return {
    enabled: true,
    source: "ai",
    status: "pending",
    label: "AI estimate. Actual values vary by restaurant and portion.",
  };
}
