import { createOpenAI } from "npm:@ai-sdk/openai@3";
import { Output, streamText, type ModelMessage } from "npm:ai@6";
import { z } from "npm:zod@4";
// El Roadmap usa directamente Lovable AI: las claves propias (OpenAI sin saldo) no deben bloquearlo.

const OutputSchema = z.object({ proposals: z.array(z.object({ id: z.string(), title: z.string(), version_id: z.string().nullable(), reason: z.string(), effort: z.enum(['small', 'medium', 'large']) }).strict()) }).strict();

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.ts";

export function createResponsesCall(
  request: Request,
  config: { baseURL: string; apiKey: string; model: string },
  messages: ModelMessage[],
  instructions?: string,
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: `${config.baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`,
    apiKey: config.apiKey,
    headers: { "Lovable-API-Key": config.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const reasoning = config.model !== "openai/chat-latest";
  let callError: unknown;
  const result = streamText({
    maxRetries: 0,
    onError: ({ error }) => { callError = error; },
    output: Output.object({ schema: OutputSchema }),
    model: provider.responses(config.model),
    // AI SDK 6 lacks `instructions`: rename this key to `system` there.
    ...(instructions ? { system: instructions } : {}),
    messages,
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        ...(reasoning
          ? {
              forceReasoning: true,
              reasoningEffort: "medium",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            }
          : {}),
      },
    },
  });
  return {
    result,
    getError: () => callError,
    response: () =>
      withLovableAiGatewayRunIdHeader(result.toUIMessageStreamResponse({ sendReasoning: true }), runIdFetch),
  };
}
