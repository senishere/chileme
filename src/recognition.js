export class RecognitionNotConfiguredError extends Error {
  constructor(message = "Recognition service is not configured.") {
    super(message);
    this.name = "RecognitionNotConfiguredError";
  }
}

const EMPTY_RECOGNIZED_NUTRITION = Object.freeze({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  sodium: 0,
  fiber: 0
});

function numericConfidence(value) {
  return Number.isFinite(value) ? value : 0;
}

export function nutritionLabelResultDraft(overrides = {}) {
  return {
    source: "nutrition_label",
    foodName: overrides.foodName || "",
    basis: "per100g",
    nutritionPer100g: {
      ...EMPTY_RECOGNIZED_NUTRITION,
      ...(overrides.nutritionPer100g || {})
    },
    notes: Array.isArray(overrides.notes) ? overrides.notes : [],
    confidence: numericConfidence(overrides.confidence)
  };
}

export function foodPhotoResultDraft(overrides = {}) {
  return {
    source: "food_photo",
    candidates: Array.isArray(overrides.candidates) ? overrides.candidates : []
  };
}

export async function recognizeNutritionLabel() {
  throw new RecognitionNotConfiguredError();
}

export async function recognizeFoodPhoto() {
  throw new RecognitionNotConfiguredError();
}
