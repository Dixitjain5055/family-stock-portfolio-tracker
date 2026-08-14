import { describe, expect, it } from "vitest";
import * as config from "./config";

describe("Supabase dashboard error state", () => {
  it("turns a failed database request into a safe user-facing status", () => {
    const getStatus = Reflect.get(config, "getSupabaseErrorStatus") as
      | ((errors: Array<{ message?: string; details?: string } | null>) => {
          title: string;
          message: string;
          retryable: boolean;
        })
      | undefined;

    expect(getStatus).toBeTypeOf("function");
    expect(
      getStatus?.([
        {
          message: "TypeError: fetch failed",
          details: "getaddrinfo ENOTFOUND example.supabase.co",
        },
      ]),
    ).toEqual({
      title: "Portfolio database unavailable",
      message:
        "Kinfolio cannot reach the configured Supabase project. Check the project URL and environment variables, then try again.",
      retryable: true,
    });
  });

  it("does not expose raw upstream error details", () => {
    const getStatus = Reflect.get(config, "getSupabaseErrorStatus") as
      | ((errors: Array<{ message?: string; details?: string } | null>) => {
          title: string;
          message: string;
          retryable: boolean;
        })
      | undefined;

    expect(getStatus).toBeTypeOf("function");
    const status = getStatus?.([{ message: "permission denied for secret_table" }]);
    expect(status).toEqual({
      title: "Portfolio data could not be loaded",
      message: "The database returned an error. Try again, or check the Supabase schema and access policies.",
      retryable: true,
    });
    expect(status?.message).not.toContain("secret_table");
  });
});
