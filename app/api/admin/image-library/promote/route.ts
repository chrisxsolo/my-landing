import { NextRequest, NextResponse } from "next/server";
import { promoteImageLibraryAssetToPortfolio } from "@/lib/imageLibrary";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

type PromoteRequestBody = {
  assetId?: unknown;
  categorySlug?: unknown;
};

function readPositiveInteger(value: unknown, fieldName: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function readRequiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }

  return trimmed;
}

function getStatusForError(message: string) {
  if (
    message === "Image library asset not found." ||
    message === "Portfolio category not found."
  ) {
    return 404;
  }

  if (
    message === "assetId must be a positive integer." ||
    message === "categorySlug is required."
  ) {
    return 400;
  }

  return 500;
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const body = (await req.json()) as PromoteRequestBody;
    const result = await promoteImageLibraryAssetToPortfolio({
      assetId: readPositiveInteger(body.assetId, "assetId"),
      categorySlug: readRequiredString(body.categorySlug, "categorySlug"),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin/image-library/promote] POST", err);
    const message =
      err instanceof Error ? err.message : "Failed to promote image library asset.";

    return NextResponse.json({ error: message }, { status: getStatusForError(message) });
  }
}
