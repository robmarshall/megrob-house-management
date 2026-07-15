import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// `client.ts` reads `import.meta.env.VITE_API_URL` at module load time and
// throws if it is missing. The project's `.env` already provides it (and
// vitest picks up `.env`/`.env.test` the same way Vite does), but we stub it
// explicitly before importing so this test is self-contained and doesn't
// depend on that file existing.
vi.stubEnv("VITE_API_URL", "http://localhost:3000");

let apiGet: typeof import("./client").apiGet;
let ApiError: typeof import("./ApiError").ApiError;

beforeAll(async () => {
  ({ apiGet } = await import("./client"));
  ({ ApiError } = await import("./ApiError"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchResponse(options: {
  ok: boolean;
  status: number;
  json: unknown;
}) {
  return vi.fn().mockResolvedValue({
    ok: options.ok,
    status: options.status,
    statusText: "",
    json: () => Promise.resolve(options.json),
  } as Response);
}

describe("apiGet", () => {
  it("rejects with an ApiError instance (also an Error) on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({
        ok: false,
        status: 404,
        json: { error: "Not found" },
      })
    );

    let caught: unknown;
    try {
      await apiGet("/things/1");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as InstanceType<typeof ApiError>).status).toBe(404);
    expect((caught as InstanceType<typeof ApiError>).message).toBe(
      "Not found"
    );
  });

  it("resolves with the parsed JSON body on a 200 response", async () => {
    const body = { id: 1, name: "Groceries" };
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({
        ok: true,
        status: 200,
        json: body,
      })
    );

    await expect(apiGet("/things/1")).resolves.toEqual(body);
  });
});
