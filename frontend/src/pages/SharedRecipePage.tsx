import { useParams } from "react-router";
import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/atoms/Card";
import { TimeBadge } from "@/components/atoms/TimeBadge";
import { usePublicRecipe } from "@/hooks/recipe/usePublicRecipe";
import { categoryLabels } from "@/types/recipe";

/**
 * SharedRecipePage
 * Public, read-only view of a recipe reached via its share link
 * (/share/recipes/:publicId). Not behind ProtectedRoute — no account needed.
 */
export function SharedRecipePage() {
  const { publicId } = useParams<{ publicId: string }>();
  const { data: recipe, isLoading } = usePublicRecipe(publicId || "");

  const parseInstructions = (instructions: string): string[] => {
    try {
      const parsed = JSON.parse(instructions);
      return Array.isArray(parsed) ? parsed : [instructions];
    } catch {
      return instructions.split("\n").filter((s) => s.trim());
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-primary-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-sm text-gray-600">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Recipe not found
          </h1>
          <p className="text-sm text-gray-500">
            This share link is invalid, or sharing has been turned off for this
            recipe.
          </p>
        </div>
      </div>
    );
  }

  const instructions = parseInstructions(recipe.instructions);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Recipe Image */}
        {recipe.imageUrl && (
          <div className="mb-6 rounded-lg overflow-hidden">
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="w-full h-64 md:h-80 object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{recipe.name}</h1>
          {recipe.description && (
            <p className="mt-2 text-gray-600">{recipe.description}</p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <TimeBadge
              prepTimeMinutes={recipe.prepTimeMinutes}
              cookTimeMinutes={recipe.cookTimeMinutes}
            />
            {recipe.servings && (
              <span className="text-sm text-gray-600">
                Serves {recipe.servings}
              </span>
            )}
            {recipe.difficulty && (
              <span className="text-sm text-gray-600 capitalize">
                {recipe.difficulty}
              </span>
            )}
            {recipe.cuisine && (
              <span className="text-sm text-gray-600">{recipe.cuisine}</span>
            )}
          </div>

          {/* Categories */}
          {recipe.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {recipe.categories.map((cat) => (
                <Badge
                  key={`${cat.categoryType}-${cat.categoryValue}`}
                  variant={
                    cat.categoryType === "allergen"
                      ? "warning"
                      : cat.categoryType === "dietary"
                      ? "success"
                      : "primary"
                  }
                >
                  {categoryLabels[cat.categoryValue] || cat.categoryValue}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ingredients */}
          <Card className="lg:col-span-1">
            <div className="p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Ingredients
              </h2>
              {recipe.ingredients.length > 0 ? (
                <ul className="space-y-2">
                  {recipe.ingredients.map((ing) => (
                    <li key={ing.id} className="flex items-start gap-2">
                      <span className="text-primary-600 mt-1">•</span>
                      <span>
                        {ing.quantity && (
                          <span className="font-medium">{ing.quantity} </span>
                        )}
                        {ing.unit && <span>{ing.unit} </span>}
                        <span>{ing.name}</span>
                        {ing.notes && (
                          <span className="text-gray-500 text-sm">
                            {" "}
                            ({ing.notes})
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">No ingredients listed</p>
              )}
            </div>
          </Card>

          {/* Instructions */}
          <Card className="lg:col-span-2">
            <div className="p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Instructions
              </h2>
              <ol className="space-y-4">
                {instructions.map((step, index) => (
                  <li key={index} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">
                      {index + 1}
                    </span>
                    <p className="text-gray-700 pt-1">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        </div>

        {/* Notes */}
        {recipe.notes && (
          <Card className="mt-6">
            <div className="p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Notes</h2>
              <p className="text-gray-600 whitespace-pre-wrap">{recipe.notes}</p>
            </div>
          </Card>
        )}

        {/* Source URL */}
        {recipe.sourceUrl && (
          <div className="mt-6 text-sm text-gray-500">
            Source:{" "}
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 underline"
            >
              {(() => {
                try {
                  return new URL(recipe.sourceUrl).hostname;
                } catch {
                  return recipe.sourceUrl;
                }
              })()}
            </a>
          </div>
        )}

        <footer className="mt-10 pb-6 text-center text-xs text-gray-400">
          Shared from Home Management
        </footer>
      </div>
    </div>
  );
}
