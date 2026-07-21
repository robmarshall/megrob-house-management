import { describe, expect, it } from "vitest";
import type { Query } from "@tanstack/react-query";
import { collectionPredicate } from "./queryKeys";

function fakeQuery(queryKey: unknown[]): Query {
  return { queryKey } as unknown as Query;
}

describe("collectionPredicate", () => {
  const matches = collectionPredicate("shopping-lists");

  it("matches the collection's own list and detail queries", () => {
    expect(matches(fakeQuery(["shopping-lists", "list", { page: 1 }]))).toBe(true);
    expect(matches(fakeQuery(["shopping-lists", "detail", 6]))).toBe(true);
  });

  it("matches nested sub-collection queries like shopping-lists/:id/items", () => {
    expect(matches(fakeQuery(["shopping-lists/6/items", "list", { page: 1 }]))).toBe(
      true
    );
  });

  it("does not match other collections", () => {
    expect(matches(fakeQuery(["recipes", "list"]))).toBe(false);
    expect(matches(fakeQuery(["meal-plans", "list"]))).toBe(false);
    // Prefix must be a full path segment, not a substring
    expect(matches(fakeQuery(["shopping-lists-archive", "list"]))).toBe(false);
  });

  it("ignores malformed keys", () => {
    expect(matches(fakeQuery([42, "list"]))).toBe(false);
    expect(matches(fakeQuery([]))).toBe(false);
  });
});
