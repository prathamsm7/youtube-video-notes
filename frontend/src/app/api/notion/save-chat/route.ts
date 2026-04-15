import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are a Markdown-to-Notion API block converter. Convert the given text into a valid JSON array of Notion API block objects.

=== CRITICAL LIMITS ===
- Each rich_text "text.content" must be ≤ 2000 characters. Split longer text into multiple rich_text objects.
- Each rich_text array can have max 100 elements.
- equation.expression max 1000 characters.
- Any URL max 2000 characters.

=== RICH TEXT OBJECT FORMAT ===
Every rich_text element must follow this structure:

For plain/styled text:
{
  "type": "text",
  "text": {
    "content": "your text here",
    "link": null  // or { "url": "https://..." } for hyperlinks
  },
  "annotations": {
    "bold": false,
    "italic": false,
    "strikethrough": false,
    "underline": false,
    "code": false,
    "color": "default"
  }
}

For inline equations (LaTeX):
{
  "type": "equation",
  "equation": { "expression": "E = mc^2" },
  "annotations": { "bold": false, "italic": false, "strikethrough": false, "underline": false, "code": false, "color": "default" }
}

=== ANNOTATIONS ===
- bold: true/false — for **bold** text
- italic: true/false — for *italic* text
- strikethrough: true/false — for ~~strikethrough~~ text
- underline: true/false — for underlined text
- code: true/false — for \`inline code\`
- color: one of "default", "blue", "blue_background", "brown", "brown_background", "gray", "gray_background", "green", "green_background", "orange", "orange_background", "pink", "pink_background", "purple", "purple_background", "red", "red_background", "yellow", "yellow_background"
- only add the annotation proprty if it is true, if any text or block dont have any annotation dont add annotation block in response.

=== BLOCK TYPES & FORMAT ===

1. PARAGRAPH:
{ "object": "block", "type": "paragraph", "paragraph": { "rich_text": [...], "color": "default" } }

2. HEADINGS (heading_1, heading_2, heading_3):
{ "object": "block", "type": "heading_1", "heading_1": { "rich_text": [...], "is_toggleable": false, "color": "default" } }
Map: # → heading_1, ## → heading_2, ### → heading_3, #### → heading_4

3. BULLETED LIST ITEM:
{ "object": "block", "type": "bulleted_list_item", "bulleted_list_item": { "rich_text": [...], "color": "default", "children": [] } }
Use "children" array for nested/indented sub-items.

4. NUMBERED LIST ITEM:
{ "object": "block", "type": "numbered_list_item", "numbered_list_item": { "rich_text": [...], "color": "default", "children": [] } }

5. TO-DO:
{ "object": "block", "type": "to_do", "to_do": { "rich_text": [...], "checked": false, "color": "default" } }
- [ ] → checked: false, - [x] → checked: true

6. TOGGLE:
{ "object": "block", "type": "toggle", "toggle": { "rich_text": [...], "color": "default", "children": [...] } }

7. CODE BLOCK:
{ "object": "block", "type": "code", "code": { "rich_text": [{ "type": "text", "text": { "content": "code here" } }], "language": "javascript", "caption": [] } }

8. QUOTE:
{ "object": "block", "type": "quote", "quote": { "rich_text": [...], "color": "default" } }

9. CALLOUT:
{ "object": "block", "type": "callout", "callout": { "rich_text": [...], "icon": { "type": "emoji", "emoji": "💡" }, "color": "default" } }

10. DIVIDER:
{ "object": "block", "type": "divider", "divider": {} }

11. BOOKMARK:
{ "object": "block", "type": "bookmark", "bookmark": { "url": "https://...", "caption": [] } }

12. EQUATION (block-level):
{ "object": "block", "type": "equation", "equation": { "expression": "LaTeX here" } }

13. TABLE:
{
  "object": "block", "type": "table",
  "table": {
    "table_width": 3,
    "has_column_header": true,
    "has_row_header": false,
    "children": [
      { "type": "table_row", "table_row": { "cells": [[{"type":"text","text":{"content":"Header1"}}],[{"type":"text","text":{"content":"Header2"}}],[{"type":"text","text":{"content":"Header3"}}]] } },
      { "type": "table_row", "table_row": { "cells": [[{"type":"text","text":{"content":"Cell1"}}],[{"type":"text","text":{"content":"Cell2"}}],[{"type":"text","text":{"content":"Cell3"}}]] } }
    ]
  }
}

14. IMAGE (external URL):
{ "object": "block", "type": "image", "image": { "type": "external", "external": { "url": "https://..." } } }

15. EMBED:
{ "object": "block", "type": "embed", "embed": { "url": "https://..." } }

=== INLINE FORMATTING RULES ===
- **bold** → annotations.bold = true
- *italic* or _italic_ → annotations.italic = true
- ~~strikethrough~~ → annotations.strikethrough = true
- \`inline code\` → annotations.code = true
- [link text](url) → text.content = "link text", text.link = { "url": "url" }
- $LaTeX$ → use equation rich_text type
- Combine annotations: ***bold italic*** → bold: true, italic: true

=== IMPORTANT RULES ===
- Split inline formatting into separate rich_text objects. E.g., "This is **bold** and normal" becomes 3 rich_text objects.
- For nested lists, use the "children" array inside the parent list item.
- Only omit "children" if there are no nested items.
- Return ONLY a valid JSON array. No markdown, no explanation, no wrapping.`;

async function convertToNotionBlocks(text: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash";

  try {
    const { text: resultText } = await ai.models.generateContent({
      model,
      config: {
        responseMimeType: "application/json",
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      contents: [{ role: "user", parts: [{ text }] }],
    });

    if (!resultText) throw new Error("No response from AI");

    // Clean up potential markdown wrapper code fences
    const jsonString = resultText.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("LLM Conversion Error:", error);
    // Fallback: simple paragraph block
    return [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: text.slice(0, 2000) } }],
        },
      },
    ];
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const { videoId, videoTitle, question, answer } = await req.json();

    if (!question || !answer || !videoId) {
      return NextResponse.json(
        { detail: "Missing required fields (videoId, question, answer)" },
        { status: 400 },
      );
    }

    const profile = await prisma.notionProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile || !profile.accessToken) {
      return NextResponse.json(
        { detail: "Notion not connected" },
        { status: 400 },
      );
    }

    const notion = new Client({ auth: profile.accessToken });

    // 1. Find the "Parent" page (the true Root Workspace)
    // We search for pages and prioritize those that have "workspace" as parent 
    // or are at the top level of what is shared.
    const searchParent = await notion.search({
      filter: { property: "object", value: "page" },
      page_size: 50, // Get more results to find the true root
    });

    // Heuristic: The Root is usually the page with parent.type === "workspace" 
    // or the one that IS NOT a child of another page in our list.
    const rootPage = searchParent.results.find((p: any) => 
      p.parent?.type === "workspace" || p.parent?.type === "block_id"
    ) || searchParent.results[0];

    if (!rootPage) {
      return NextResponse.json({ detail: "No Notion pages found. Please share a page with your integration." }, { status: 400 });
    }

    const rootPageId = rootPage.id;

    // 2. Search for an existing page for THIS video
    // We search for pages that are specifically CHILDREN of our Root Page
    // to avoid accidentally matching something else.
    const searchVideoPage = await notion.search({
      query: videoTitle,
      filter: { property: "object", value: "page" },
      page_size: 20,
    });

    // Heuristic to find the page by title in search results
    let targetPageId = "";
    for (const page of searchVideoPage.results as any[]) {
      const titleProp = page.properties?.title?.title || page.properties?.Name?.title;
      const pageTitle = titleProp?.[0]?.plain_text;
      if (pageTitle === videoTitle) {
        targetPageId = page.id;
        break;
      }
    }

    // 3. Create page if it doesn't exist
    if (!targetPageId) {
      console.log(`[notion] Creating new page for video: ${videoTitle}`);
      const newPage = await notion.pages.create({
        parent: { page_id: rootPageId },
        properties: {
          title: {
            title: [
              {
                text: { content: videoTitle },
              },
            ],
          },
        },
      });
      targetPageId = newPage.id;
    }

    // 4. Convert AI answer to Notion blocks
    const aiBlocks = await convertToNotionBlocks(answer);

    // 5. Append formatted note (Question as heading, then answer)
    await notion.blocks.children.append({
      block_id: targetPageId,
      children: [
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [
              { type: "text", text: { content: question } },
            ],
            color: "blue_background"
          },
        },
        ...aiBlocks,
        {
          object: "block",
          type: "divider",
          divider: {},
        },
      ],
    });

    return NextResponse.json({ status: "success" });
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Notion save error:", error);
    return NextResponse.json({ detail: errorMsg }, { status: 500 });
  }
}
