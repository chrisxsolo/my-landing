import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/get-user";
import { isAdminUser } from "@/lib/auth/is-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isAdmin = await isAdminUser(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      is_admin: isAdmin,
    });
  } catch (err) {
    console.error("[auth/me]", err);
    return NextResponse.json({ error: "Auth check failed" }, { status: 500 });
  }
}
