import { NextRequest, NextResponse } from "next/server";
import {
  listImageLibraryAssets,
  syncJournalPostImagesToLibrary,
} from "@/lib/imageLibrary";
import { IMAGE_LIBRARY_SOURCE_TYPES } from "@/lib/imageLibraryShared";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

type SyncPostRequestBody = {
  mode?: unknown;
  postId?: unknown;
  postSlug?: unknown;
  postTitle?: unknown;
  coverImageUrl?: unknown;
  extraImageUrls?: unknown;
};

function readOptionalString(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function readRequiredString(value: unknown, fieldName: string) {
  const text = readOptionalString(value);
  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }

  return text;
}

function readPositiveInteger(value: unknown, fieldName: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function readImageUrlArray(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("extraImageUrls must be an array.");
  }

  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`extraImageUrls[${index}] must be a string.`);
    }

    const trimmed = item.trim();
    if (!trimmed) {
      throw new Error(`extraImageUrls[${index}] cannot be empty.`);
    }

    return trimmed;
  });
}

function parseListQuery(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sourceType = searchParams.get("sourceType");
  const sourcePostId = searchParams.get("sourcePostId");
  const limit = searchParams.get("limit");
  const inPortfolio = searchParams.get("inPortfolio");

  if (sourceType && sourceType !== IMAGE_LIBRARY_SOURCE_TYPES.journal) {
    throw new Error("sourceType must be 'journal'.");
  }

  let parsedSourcePostId: number | undefined;
  if (sourcePostId !== null) {
    parsedSourcePostId = readPositiveInteger(sourcePostId, "sourcePostId");
  }

  let parsedLimit: number | undefined;
  if (limit !== null) {
    parsedLimit = readPositiveInteger(limit, "limit");
  }

  let parsedInPortfolio: boolean | undefined;
  if (inPortfolio !== null) {
    if (inPortfolio === "true") parsedInPortfolio = true;
    else if (inPortfolio === "false") parsedInPortfolio = false;
    else throw new Error("inPortfolio must be 'true' or 'false'.");
  }

  return {
    sourceType: sourceType ?? undefined,
    sourcePostId: parsedSourcePostId,
    limit: parsedLimit,
    inPortfolio: parsedInPortfolio,
  };
}

function parseSyncPostBody(body: SyncPostRequestBody) {
  const mode = readRequiredString(body.mode, "mode");
  if (mode !== "sync-post") {
    throw new Error("Unsupported mode.");
  }

  const coverImageUrl = readOptionalString(body.coverImageUrl);

  return {
    mode,
    postId: readPositiveInteger(body.postId, "postId"),
    postSlug: readRequiredString(body.postSlug, "postSlug"),
    postTitle: readRequiredString(body.postTitle, "postTitle"),
    coverImageUrl,
    extraImageUrls: readImageUrlArray(body.extraImageUrls ?? []),
  };
}

function getErrorStatus(message: string) {
  if (
    message === "sourceType must be 'journal'." ||
    message === "inPortfolio must be 'true' or 'false'." ||
    message === "Unsupported mode." ||
    message.endsWith("is required.") ||
    message.endsWith("must be a positive integer.") ||
    message === "extraImageUrls must be an array." ||
    message.includes("extraImageUrls[") ||
    message.includes("cannot be empty.")
  ) {
    return 400;
  }

  return 500;
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const assets = await listImageLibraryAssets(parseListQuery(req));
    return NextResponse.json({ assets });
  } catch (err) {
    console.error("[admin/image-library] GET", err);
    const message = err instanceof Error ? err.message : "Failed to load image library.";
    return NextResponse.json(
      { error: message },
      { status: getErrorStatus(message) },
    );
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const body = (await req.json()) as SyncPostRequestBody;
    const input = parseSyncPostBody(body);
    const result = await syncJournalPostImagesToLibrary({
      postId: input.postId,
      postSlug: input.postSlug,
      postTitle: input.postTitle,
      coverImageUrl: input.coverImageUrl,
      extraImageUrls: input.extraImageUrls,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin/image-library] POST", err);
    const message = err instanceof Error ? err.message : "Failed to sync image library.";
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) });
  }
}
