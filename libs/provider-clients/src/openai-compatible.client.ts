import { Injectable, Logger } from "@nestjs/common";

export interface ProviderAdapter {
  name: "moonshot" | "z-ai";
  apiKeyEnv: string;
  defaultBaseUrl: string;
}

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CreateChatCompletionParams {
  providerName: ProviderAdapter["name"];
  stageName?: string;
  model: string;
  messages: ChatCompletionMessage[];
  temperature: number;
  maxTokens?: number;
  timeoutSeconds?: number;
  stream?: boolean;
  maxRetries?: number;
  onStreamDelta?: (fieldName: "content" | "reasoning_content", text: string) => void;
}

type UsageShape = Record<string, number | Record<string, number>>;
type ChatCompletionResponse = Record<string, unknown> & {
  choices?: Array<Record<string, unknown>>;
  usage?: UsageShape;
};

@Injectable()
export class OpenAiCompatibleClient {
  private readonly logger = new Logger(OpenAiCompatibleClient.name);

  private readonly providers: Record<ProviderAdapter["name"], ProviderAdapter> = {
    moonshot: {
      name: "moonshot",
      apiKeyEnv: "MOONSHOT_API_KEY",
      defaultBaseUrl: "https://api.moonshot.ai/v1"
    },
    "z-ai": {
      name: "z-ai",
      apiKeyEnv: "ZAI_API_KEY",
      defaultBaseUrl: "https://api.z.ai/api/paas/v4"
    }
  };

  async createChatCompletion(params: CreateChatCompletionParams): Promise<ChatCompletionResponse> {
    const provider = this.providers[params.providerName];
    if (!provider) {
      throw new Error(`Unsupported provider '${params.providerName}'.`);
    }

    const apiKey = process.env[provider.apiKeyEnv];
    if (!apiKey) {
      throw new Error(
        `Missing API key for provider '${provider.name}'. Set ${provider.apiKeyEnv} in the environment or .env.`
      );
    }

    const baseUrlEnv = `${provider.name.toUpperCase().replaceAll("-", "_")}_BASE_URL`;
    const baseUrl = (process.env[baseUrlEnv] ?? provider.defaultBaseUrl).replace(/\/+$/u, "");
    const requestUrl = `${baseUrl}/chat/completions`;
    const stageLabel = params.stageName ?? "unspecified";
    const payload: Record<string, unknown> = {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature
    };
    if (params.maxTokens !== undefined) {
      payload.max_tokens = params.maxTokens;
    }
    if (params.stream) {
      payload.stream = true;
    }

    const maxRetries = params.maxRetries ?? 2;
    let attempt = 0;
    while (true) {
      const controller = new AbortController();
      const timeoutHandle =
        params.timeoutSeconds !== undefined
          ? setTimeout(() => controller.abort(), params.timeoutSeconds * 1000)
          : undefined;
      try {
        this.logger.log(
          `stage=${stageLabel} provider=${provider.name} model=${params.model} attempt=${attempt + 1}/${maxRetries + 1} url=${requestUrl} stream=${params.stream ? "true" : "false"}`
        );

        const response = await fetch(requestUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (response.status === 429 && attempt < maxRetries) {
          const retryDelaySeconds = this.retryDelaySeconds(response, attempt);
          this.logger.warn(
            `stage=${stageLabel} provider=${provider.name} model=${params.model} received HTTP 429; retrying in ${retryDelaySeconds}s`
          );
          await this.sleep(retryDelaySeconds * 1000);
          attempt += 1;
          continue;
        }
        if (!response.ok) {
          const responseText = await response.text();
          throw new Error(
            `stage=${stageLabel} provider=${provider.name} model=${params.model} API request failed with HTTP ${response.status} from ${requestUrl}: ${responseText}`
          );
        }

        const parsed = params.stream
          ? await this.readStreamingChatCompletion(response, params.onStreamDelta)
          : ((await response.json()) as ChatCompletionResponse);

        if (this.isEngineOverloadedResponse(parsed)) {
          if (attempt < maxRetries) {
            this.logger.warn(
              `stage=${stageLabel} provider=${provider.name} model=${params.model} received engine_overloaded; retrying in ${2 ** attempt}s`
            );
            await this.sleep(2 ** attempt * 1000);
            attempt += 1;
            continue;
          }
          throw new Error(
            `${provider.name} response ended with finish_reason 'engine_overloaded' before returning final content.`
          );
        }

        return parsed;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if ((error as Error).name === "AbortError") {
          throw new Error(
            `stage=${stageLabel} provider=${provider.name} model=${params.model} API request to ${requestUrl} timed out.`
          );
        }
        if (error instanceof TypeError) {
          throw new Error(
            `stage=${stageLabel} provider=${provider.name} model=${params.model} API request failed before receiving a response from ${requestUrl}: ${message}`
          );
        }
        this.logger.error(
          `stage=${stageLabel} provider=${provider.name} model=${params.model} request failed: ${message}`
        );
        throw error;
      } finally {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
      }
    }
  }

  extractMessageText(response: ChatCompletionResponse): string {
    const choices = response.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new Error(`Model response did not contain choices: ${JSON.stringify(response)}`);
    }
    const message = choices[0]?.message;
    if (typeof message === "object" && message !== null) {
      const content = (message as Record<string, unknown>).content;
      if (typeof content === "string") {
        return content;
      }
      if (Array.isArray(content)) {
        const parts = content
          .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
          .map((item) => (item.type === "text" && typeof item.text === "string" ? item.text : ""))
          .filter(Boolean);
        if (parts.length > 0) {
          return parts.join("\n");
        }
      }
    }
    throw new Error(`Could not extract text content from model response: ${JSON.stringify(response)}`);
  }

  async smokeTestStage(stageName: string, stage: {
    provider: ProviderAdapter["name"];
    model: string;
    temperature: number;
    timeout_seconds?: number;
  }): Promise<void> {
    try {
      await this.createChatCompletion({
        providerName: stage.provider,
        stageName: stageName,
        model: stage.model,
        messages: [{ role: "user", content: `Reply with OK for ${stageName}.` }],
        temperature: stage.temperature,
        maxTokens: 1,
        timeoutSeconds: stage.timeout_seconds,
        stream: false
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Provider smoke test failed for stage '${stageName}' (${stage.provider}/${stage.model}): ${message}`);
    }
  }

  private async readStreamingChatCompletion(
    response: Response,
    onStreamDelta?: (fieldName: "content" | "reasoning_content", text: string) => void
  ): Promise<ChatCompletionResponse> {
    if (!response.body) {
      throw new Error("Streaming model response did not contain a response body.");
    }
    const decoder = new TextDecoder();
    const reader = response.body.getReader();

    let completionId = "";
    let created = 0;
    let model = "";
    let role = "assistant";
    let finishReason: string | null = null;
    let usage: UsageShape | undefined;
    let buffered = "";
    let sawChunk = false;
    const contentParts: string[] = [];
    const reasoningParts: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffered += decoder.decode(value, { stream: true });
      const events = buffered.split(/\r?\n\r?\n/u);
      buffered = events.pop() ?? "";
      for (const event of events) {
        const dataLines = event
          .split(/\r?\n/u)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart());
        if (dataLines.length === 0) {
          continue;
        }
        const data = dataLines.join("\n").trim();
        if (!data) {
          continue;
        }
        if (data === "[DONE]") {
          continue;
        }
        const chunk = JSON.parse(data) as ChatCompletionResponse;
        sawChunk = true;
        if (typeof chunk.id === "string") {
          completionId = completionId || chunk.id;
        }
        if (typeof chunk.created === "number") {
          created = created || chunk.created;
        }
        if (typeof chunk.model === "string") {
          model = model || chunk.model;
        }
        if (chunk.usage && typeof chunk.usage === "object") {
          usage = chunk.usage;
        }
        const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined;
        if (choice && typeof choice === "object") {
          const delta = choice.delta;
          if (delta && typeof delta === "object") {
            if (typeof (delta as Record<string, unknown>).role === "string") {
              role = (delta as Record<string, unknown>).role as string;
            }
            for (const fieldName of ["reasoning_content", "content"] as const) {
              const piece = (delta as Record<string, unknown>)[fieldName];
              if (typeof piece === "string" && piece.length > 0) {
                if (fieldName === "content") {
                  contentParts.push(piece);
                } else {
                  reasoningParts.push(piece);
                }
                onStreamDelta?.(fieldName, piece);
              }
            }
          }
          if (typeof choice.finish_reason === "string" && choice.finish_reason.length > 0) {
            finishReason = choice.finish_reason;
          }
        }
      }
    }

    if (!sawChunk) {
      throw new Error("Streaming model response did not contain any data chunks.");
    }

    return {
      id: completionId,
      object: "chat.completion",
      created,
      model,
      choices: [
        {
          index: 0,
          message: {
            role,
            content: contentParts.join(""),
            reasoning_content: reasoningParts.join("")
          },
          finish_reason: finishReason
        }
      ],
      ...(usage ? { usage } : {})
    };
  }

  private retryDelaySeconds(response: Response, attempt: number): number {
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) {
      const parsed = Number(retryAfter);
      if (!Number.isNaN(parsed)) {
        return Math.max(parsed, 0);
      }
    }
    return 2 ** attempt;
  }

  private isEngineOverloadedResponse(response: ChatCompletionResponse): boolean {
    const firstChoice = Array.isArray(response.choices) ? response.choices[0] : undefined;
    return !!(firstChoice && typeof firstChoice === "object" && firstChoice.finish_reason === "engine_overloaded");
  }

  private async sleep(milliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
