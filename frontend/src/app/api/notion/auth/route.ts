import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/notion/auth
 *
 * Receives the temporary `code` from the Notion OAuth callback,
 * exchanges it for a long-lived access token using the client credentials
 * stored server-side, then returns the workspace name to the frontend.
 *
 * The access_token MUST be persisted in your database (keyed by user ID)
 * before returning. Add that step in the TODO below.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = body as { code?: string };

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid `code` parameter." },
        { status: 400 },
      );
    }

    const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
    const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error(
        "[notion/auth] Missing server-side env vars: " +
          "NOTION_OAUTH_CLIENT_ID, NOTION_OAUTH_CLIENT_SECRET, NOTION_OAUTH_REDIRECT_URI",
      );
      return NextResponse.json(
        { success: false, error: "Server misconfiguration." },
        { status: 500 },
      );
    }

    // Base64-encode "clientId:clientSecret" for HTTP Basic auth
    const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64",
    );

    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${encoded}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    console.log("🚀 ~ POST ~ tokenData:", tokenData);

    if (!tokenRes.ok) {
      console.error("[notion/auth] Token exchange failed:", tokenData);
      return NextResponse.json(
        {
          success: false,
          error:
            tokenData?.error_description ??
            tokenData?.error ??
            "Failed to exchange code for token.",
        },
        { status: tokenRes.status },
      );
    }

    const { access_token, bot_id, workspace_id, workspace_name } = tokenData;

    // ── Persist the token ──────────────────────────────────────────────────
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await prisma.notionProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        accessToken: access_token,
        workspaceId: workspace_id,
        workspaceName: workspace_name,
        botId: bot_id,
      },
      update: {
        accessToken: access_token,
        workspaceId: workspace_id,
        workspaceName: workspace_name,
        botId: bot_id,
      },
    });
    // ──────────────────────────────────────────────────────────────────────

    console.log(
      `[notion/auth] Connected workspace "${workspace_name}" (id: ${workspace_id})`,
    );

    return NextResponse.json({
      success: true,
      workspace_name,
    });
  } catch (err) {
    console.error("[notion/auth] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 },
    );
  }
}
