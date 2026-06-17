import { IngredientItem } from "@/constants/types";

export const createEmptyIngredient = (): IngredientItem => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: "",
  quantity: "",
  carbs: 0,
  fats: 0,
  proteins: 0,
  calories: 0,
});

export const toIngredientSummary = (ingredients: IngredientItem[]): string => {
  const labels = ingredients
    .map((ingredient) => ingredient.name.trim())
    .filter((name) => name.length > 0);

  if (!labels.length) {
    return "Meal";
  }

  return labels.join(", ");
};

export const normalizeIngredientList = (
  ingredients: IngredientItem[] | null | undefined,
  fallbackDescription?: string
): IngredientItem[] => {
  if (Array.isArray(ingredients) && ingredients.length > 0) {
    return ingredients
      .filter((ingredient) => ingredient && typeof ingredient === "object")
      .map((ingredient, index) => ({
        id:
          typeof ingredient.id === "string" && ingredient.id.trim().length > 0
            ? ingredient.id
            : `ing-${Date.now()}-${index}`,
        name: typeof ingredient.name === "string" ? ingredient.name.trim() : "",
        quantity:
          typeof ingredient.quantity === "string" ? ingredient.quantity.trim() : "",
        carbs:
          typeof ingredient.carbs === "number" && Number.isFinite(ingredient.carbs) && ingredient.carbs >= 0
            ? ingredient.carbs
            : 0,
        fats:
          typeof ingredient.fats === "number" && Number.isFinite(ingredient.fats) && ingredient.fats >= 0
            ? ingredient.fats
            : 0,
        proteins:
          typeof ingredient.proteins === "number" &&
          Number.isFinite(ingredient.proteins) &&
          ingredient.proteins >= 0
            ? ingredient.proteins
            : 0,
        calories:
          typeof ingredient.calories === "number" &&
          Number.isFinite(ingredient.calories) &&
          ingredient.calories >= 0
            ? ingredient.calories
            : Math.round(
                ((typeof ingredient.carbs === "number" ? ingredient.carbs : 0) * 4 +
                  (typeof ingredient.proteins === "number" ? ingredient.proteins : 0) * 4 +
                  (typeof ingredient.fats === "number" ? ingredient.fats : 0) * 9) *
                  10
              ) / 10,
        sources:
          Array.isArray(ingredient.sources) && ingredient.sources.length > 0
            ? ingredient.sources.filter(
                (source): source is string => typeof source === "string" && source.trim().length > 0
              )
            : undefined,
        unit: typeof ingredient.unit === "string" ? ingredient.unit.trim() : undefined,
        preparation:
          typeof ingredient.preparation === "string"
            ? ingredient.preparation.trim()
            : undefined,
        note: typeof ingredient.note === "string" ? ingredient.note.trim() : undefined,
      }))
      .filter((ingredient) => ingredient.name.length > 0 && ingredient.quantity.length > 0);
  }

  if (typeof fallbackDescription === "string" && fallbackDescription.trim().length > 0) {
    return [
      {
        id: `legacy-${Date.now()}`,
        name: fallbackDescription.trim(),
        quantity: "1 serving",
        carbs: 0,
        fats: 0,
        proteins: 0,
        calories: 0,
      },
    ];
  }

  return [];
};

export const isIngredientListValid = (ingredients: IngredientItem[]): boolean =>
  ingredients.length > 0 &&
  ingredients.every(
    (ingredient) =>
      ingredient.name.trim().length > 0 &&
      ingredient.quantity.trim().length > 0 &&
      Number.isFinite(ingredient.carbs) &&
      ingredient.carbs >= 0 &&
      Number.isFinite(ingredient.fats) &&
      ingredient.fats >= 0 &&
      Number.isFinite(ingredient.proteins) &&
      ingredient.proteins >= 0 &&
      Number.isFinite(ingredient.calories) &&
      ingredient.calories >= 0
  );
