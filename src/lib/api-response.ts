import { NextResponse } from "next/server";
import { HiobuyApiError } from "@/lib/hiobuy";

export function jsonError(err: unknown) {
  if (err instanceof HiobuyApiError) {
    return NextResponse.json(
      {
        error: {
          code: err.code || "HIOBUY_ERROR",
          message: err.message,
          request_id: err.requestId,
        },
      },
      { status: err.status },
    );
  }

  console.error(err);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Unexpected error",
      },
    },
    { status: 500 },
  );
}
