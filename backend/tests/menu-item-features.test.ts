import test from "node:test";
import assert from "node:assert/strict";
import { isSameDish, normalizeDishName } from "../src/services/menu/dish-matcher.service";
import {
  validateAndClampNutrition,
  computeInputHash,
  NUTRITION_PROMPT_VERSION,
} from "../src/services/nutrition/nutrition.service";

test("dishMatcher: exact and normalized positive matches", () => {
  assert.equal(isSameDish("Classic Beef Burger", "Beef Burger"), true);
  assert.equal(isSameDish("Chicken Burger (Regular)", "Chicken Burger"), true);
  assert.equal(isSameDish("কাচ্চি বিরিয়ানি", "Kacchi Biryani"), true);
  assert.equal(isSameDish("French Fries (Large)", "fries"), true);
  assert.equal(isSameDish("Chicken Chowmein", "চিকেন চাউমিন"), true);
});

test("dishMatcher: strict negative matches (precision over recall)", () => {
  // Fry vs Curry
  assert.equal(isSameDish("Chicken Fry", "Chicken Curry"), false);
  assert.equal(isSameDish("Crispy Fried Chicken", "Chicken Bhuna"), false);

  // Bhuna vs Tehari
  assert.equal(isSameDish("Beef Bhuna", "Beef Tehari"), false);
  assert.equal(isSameDish("Mutton Kacchi", "Mutton Khichuri"), false);

  // Different core protein
  assert.equal(isSameDish("Beef Burger", "Chicken Burger"), false);
  assert.equal(isSameDish("Chicken Pizza", "Beef Pizza"), false);

  // Different dish types
  assert.equal(isSameDish("Chicken Wings", "Chicken Nuggets"), false);
  assert.equal(isSameDish("Chicken Burger", "Chicken Sandwich"), false);
  assert.equal(isSameDish("Chicken Soup", "Chicken Salad"), false);
  assert.equal(isSameDish("Beef Pizza", "Beef Burger"), false);
});

test("nutritionService: schema validation & plausibility clamps", () => {
  // Valid payload
  const valid = validateAndClampNutrition({
    servingSizeDescription: "1 burger (approx 220g)",
    caloriesMin: 450,
    caloriesMax: 550,
    proteinGrams: 28,
    carbsGrams: 42,
    fatGrams: 20,
  });

  assert.ok(valid);
  assert.equal(valid.caloriesMin, 450);
  assert.equal(valid.caloriesMax, 550);
  assert.equal(valid.proteinGrams, 28);

  // Inverted min/max is automatically swapped
  const inverted = validateAndClampNutrition({
    servingSizeDescription: "1 portion",
    caloriesMin: 600,
    caloriesMax: 400,
  });
  assert.ok(inverted);
  assert.equal(inverted.caloriesMin, 400);
  assert.equal(inverted.caloriesMax, 600);

  // Nonsense values clamped
  const clamped = validateAndClampNutrition({
    servingSizeDescription: "1 plate",
    caloriesMin: 10,
    caloriesMax: 9999,
  });
  assert.ok(clamped);
  assert.equal(clamped.caloriesMin, 30);
  assert.equal(clamped.caloriesMax, 3500);

  // Invalid payload returns null
  assert.equal(validateAndClampNutrition("not-json"), null);
  assert.equal(validateAndClampNutrition({}), null);
});

test("nutritionService: deterministic input hash and prompt version", () => {
  const hash1 = computeInputHash("Beef Burger", "Delicious beef burger", "Regular");
  const hash2 = computeInputHash("beef burger", "Delicious beef burger", "Regular");
  const hash3 = computeInputHash("Chicken Burger", "Delicious beef burger", "Regular");

  assert.equal(hash1, hash2, "Normalized names must yield identical hash");
  assert.notEqual(hash1, hash3, "Different items must yield distinct hash");
  assert.equal(typeof NUTRITION_PROMPT_VERSION, "string");
});
