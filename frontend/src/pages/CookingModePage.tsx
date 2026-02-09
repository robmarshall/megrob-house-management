import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { useRecipe } from "@/hooks/recipe/useRecipes";
import { scaleQuantity } from "@/components/molecules/ServingScaler";
import type { RecipeIngredient } from "@/types/recipe";

/**
 * Basic ingredient-to-step matching: returns ingredients whose name appears
 * in the instruction text (case-insensitive). Falls back to all ingredients
 * if no matches are found, so the user always sees something useful.
 */
function getRelevantIngredients(
  instruction: string,
  allIngredients: RecipeIngredient[]
): RecipeIngredient[] {
  const lower = instruction.toLowerCase();
  const matched = allIngredients.filter((ing) =>
    lower.includes(ing.name.toLowerCase())
  );
  return matched.length > 0 ? matched : allIngredients;
}

export function CookingModePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recipeId = parseInt(id || "0", 10);
  const { data: recipe, isLoading, error } = useRecipe(recipeId);

  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Parse instructions
  const instructions = useMemo(() => {
    if (!recipe) return [];
    try {
      const parsed = JSON.parse(recipe.instructions);
      return Array.isArray(parsed) ? parsed : [recipe.instructions];
    } catch {
      return recipe.instructions.split("\n").filter((s: string) => s.trim());
    }
  }, [recipe]);

  const totalSteps = instructions.length;

  // Relevant ingredients for current step
  const relevantIngredients = useMemo(() => {
    if (!recipe?.ingredients || !instructions[currentStep]) return [];
    return getRelevantIngredients(instructions[currentStep], recipe.ingredients);
  }, [recipe?.ingredients, instructions, currentStep]);

  // Request Wake Lock to keep screen on
  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        const lock = await navigator.wakeLock.request("screen");
        wakeLockRef.current = lock;
      }
    } catch {
      // Wake Lock not supported or permission denied — silently ignore
    }
  }, []);

  // Release Wake Lock using ref (avoids stale closure)
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // Lock may already be released — ignore
      }
      wakeLockRef.current = null;
    }
  }, []);

  // Request wake lock on mount, release on unmount
  useEffect(() => {
    requestWakeLock();
    return () => {
      try {
        wakeLockRef.current?.release();
      } catch {
        // Lock may already be released — ignore
      }
    };
  }, [requestWakeLock]);

  // Re-request wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [requestWakeLock]);

  const handleExit = useCallback(async () => {
    await releaseWakeLock();
    navigate(`/recipes/${recipeId}`);
  }, [releaseWakeLock, navigate, recipeId]);

  // Keyboard navigation — uses refs/callbacks to avoid stale closures
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
      } else if (e.key === " ") {
        // Skip spacebar when a button or other interactive element is focused
        if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
        e.preventDefault();
        setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentStep((s) => Math.max(s - 1, 0));
      } else if (e.key === "Escape") {
        handleExit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalSteps, handleExit]);

  const handlePrev = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleNext = () => {
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-primary-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-gray-600">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">Failed to load recipe.</p>
          <p className="text-sm text-gray-500 mb-4">{error.message}</p>
          <button onClick={() => navigate(`/recipes/${recipeId}`)} className="text-primary-600 hover:text-primary-700 font-medium">
            <ArrowLeftIcon className="w-5 h-5 inline mr-1" />
            Back to Recipe
          </button>
        </div>
      </div>
    );
  }

  if (!recipe || totalSteps === 0) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-4">Recipe not found or has no instructions.</p>
          <button onClick={() => navigate(`/recipes/${recipeId}`)} className="text-primary-600 hover:text-primary-700 font-medium">
            <ArrowLeftIcon className="w-5 h-5 inline mr-1" />
            Back to Recipe
          </button>
        </div>
      </div>
    );
  }

  const hasIngredients = recipe.ingredients && recipe.ingredients.length > 0;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleExit}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors flex-shrink-0"
            aria-label="Exit cooking mode"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 truncate">{recipe.name}</h1>
        </div>
        <span className="text-sm text-gray-500 flex-shrink-0">
          Step {currentStep + 1} of {totalSteps}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200">
        <div
          className="h-full bg-primary-600 transition-all duration-300"
          style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Instruction (center) */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-12">
          <div className="max-w-2xl w-full text-center">
            <span className="inline-block text-sm font-medium text-primary-600 mb-4">
              Step {currentStep + 1}
            </span>
            <p className="text-xl md:text-2xl lg:text-3xl leading-relaxed text-gray-900">
              {instructions[currentStep]}
            </p>
          </div>
        </div>

        {/* Ingredient reference panel (sidebar on large screens) */}
        {hasIngredients && (
          <div className="hidden lg:block w-72 border-l border-gray-200 bg-gray-50 overflow-y-auto p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Ingredients
            </h2>
            <ul className="space-y-2">
              {relevantIngredients.map((ing) => (
                <li key={ing.id} className="text-sm text-gray-700">
                  <span className="text-primary-600 mr-1">&bull;</span>
                  {ing.quantity && (
                    <span className="font-medium">{scaleQuantity(ing.quantity, 1)} </span>
                  )}
                  {ing.unit && <span>{ing.unit} </span>}
                  <span>{ing.name}</span>
                  {ing.notes && (
                    <span className="text-gray-400"> ({ing.notes})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Mobile ingredient toggle (visible below lg breakpoint) */}
      {hasIngredients && (
        <div className="lg:hidden border-t border-gray-200">
          <button
            onClick={() => setShowIngredients((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span>Ingredients</span>
            {showIngredients ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronUpIcon className="w-4 h-4" />
            )}
          </button>
          {showIngredients && (
            <div className="max-h-48 overflow-y-auto px-4 py-2 bg-gray-50">
              <ul className="space-y-1.5">
                {relevantIngredients.map((ing) => (
                  <li key={ing.id} className="text-sm text-gray-700">
                    <span className="text-primary-600 mr-1">&bull;</span>
                    {ing.quantity && (
                      <span className="font-medium">{scaleQuantity(ing.quantity, 1)} </span>
                    )}
                    {ing.unit && <span>{ing.unit} </span>}
                    <span>{ing.name}</span>
                    {ing.notes && (
                      <span className="text-gray-400"> ({ing.notes})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Navigation footer */}
      <div className="flex items-center justify-between px-4 py-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Step indicators */}
        <div className="flex items-center gap-1.5">
          {totalSteps <= 12 ? (
            instructions.map((_: string, index: number) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  index === currentStep
                    ? "bg-primary-600"
                    : index < currentStep
                    ? "bg-primary-300"
                    : "bg-gray-300"
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))
          ) : (
            <span className="text-sm text-gray-500">
              {currentStep + 1} / {totalSteps}
            </span>
          )}
        </div>

        <button
          onClick={handleNext}
          disabled={currentStep === totalSteps - 1}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
