import mongoose, { Document, Schema } from "mongoose";

export interface INutritionEstimate extends Document {
  cacheKey: string;
  canonicalSlug?: string;
  normalizedName: string;
  portionDescriptor: string;
  servingSizeDescription: string;
  caloriesMin: number;
  caloriesMax: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  inputHash: string;
  promptVersion: string;
  aiModel: string;
  status: "ready" | "pending" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const nutritionEstimateSchema = new Schema<INutritionEstimate>(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    canonicalSlug: { type: String, index: true },
    normalizedName: { type: String, required: true, index: true },
    portionDescriptor: { type: String, default: "standard" },
    servingSizeDescription: { type: String, required: true },
    caloriesMin: { type: Number, required: true, min: 20, max: 5000 },
    caloriesMax: { type: Number, required: true, min: 20, max: 5000 },
    proteinGrams: { type: Number, min: 0, max: 500 },
    carbsGrams: { type: Number, min: 0, max: 500 },
    fatGrams: { type: Number, min: 0, max: 500 },
    inputHash: { type: String, required: true, index: true },
    promptVersion: { type: String, required: true, default: "v1" },
    aiModel: { type: String, required: true },
    status: {
      type: String,
      enum: ["ready", "pending", "failed"],
      default: "ready",
      index: true,
    },
  },
  { timestamps: true }
);

export const NutritionEstimate = mongoose.model<INutritionEstimate>(
  "NutritionEstimate",
  nutritionEstimateSchema
);
