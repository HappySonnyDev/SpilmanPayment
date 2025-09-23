import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";

// Initialize OpenRouter provider
const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    await requireAuth(req);

    const { messages }: { messages: UIMessage[] } = await req.json();
  
    
    const result = streamText({
      model: openrouter("deepseek/deepseek-chat-v3.1:free"),
      messages: convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);

    if (error instanceof Error && error.message === "Authentication required") {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
