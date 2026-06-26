import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/notion/auth
 *
 * Exchanges the Notion OAuth code for a workspace access token and stores it
 * on the authenticated user's NotionProfile.
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
      console.error("[notion/auth] Missing Notion OAuth environment variables");
      return NextResponse.json(
        { success: false, error: "Server misconfiguration." },
        { status: 500 },
      );
    }

    const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

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

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      bot_id?: string;
      workspace_id?: string;
      workspace_name?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok) {
      console.error(
        "[notion/auth] Token exchange failed:",
        tokenRes.status,
        tokenData.error ?? tokenData.error_description ?? "unknown error",
      );
      return NextResponse.json(
        {
          success: false,
          error:
            tokenData.error_description ??
            tokenData.error ??
            "Failed to exchange code for token.",
        },
        { status: tokenRes.status },
      );
    }

    const { access_token, bot_id, workspace_id, workspace_name } = tokenData;

    if (!access_token) {
      return NextResponse.json(
        { success: false, error: "Notion did not return an access token." },
        { status: 502 },
      );
    }

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

    console.log(`[notion/auth] Connected workspace "${workspace_name ?? "unknown"}"`);

    return NextResponse.json({
      success: true,
      workspace_name,
    });
  } catch (err) {
    console.error("[notion/auth] Unexpected error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 },
    );
  }
}
