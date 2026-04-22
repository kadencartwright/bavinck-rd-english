import { Injectable } from "@nestjs/common";
import {
  ClientRegistry,
  Collector,
  type FunctionLog,
  type HTTPRequest,
  type HTTPResponse,
  type LlmCall,
  type LlmStreamCall,
  type Timing,
  type Usage
} from "@boundaryml/baml";

import { ModelProfile } from "@calibration-domain";

import { b, type CalibrationReview } from "./baml_client";

type StageProfile = ModelProfile["stages"]["translation"];
type PromptMessage = { role: "system" | "user" | "assistant"; content: string };

interface ProviderConfig {
  apiKeyEnv: string;
  baseUrlEnv: string;
  defaultBaseUrl: string;
}

interface BaseExecutionResult<TValue> {
  value: TValue;
  messages: PromptMessage[];
  prompt: { system: string; user: string };
  promptFiles: Record<string, string>;
  response: Record<string, unknown>;
  finishReason?: string;
  usage?: Record<string, number>;
}

export interface TranslateExecutionInput {
  promptBundleId: string;
  stage: StageProfile;
  runId: string;
  sliceId: string;
  sliceTitle: string;
  selectionRationale: string;
  sourceExcerpt: string;
  glossaryTerms: string;
  styleGuide: string;
  stream?: boolean;
  onStreamDelta?: (fieldName: "content" | "reasoning_content", text: string) => void;
}

export interface RepairExecutionInput {
  promptBundleId: string;
  stage: StageProfile;
  runId: string;
  sliceId: string;
  repairRound: number;
  currentDraft: string;
  hardDefectsJson: string;
  stream?: boolean;
  onStreamDelta?: (fieldName: "content" | "reasoning_content", text: string) => void;
}

export interface ReviewExecutionInput {
  promptBundleId: string;
  stage: StageProfile;
  runId: string;
  sliceId: string;
  sliceTitle: string;
  sourceExcerpt: string;
  translationOutput: string;
  glossaryTerms: string;
  styleGuide: string;
  rubric: string;
  stream?: boolean;
  onStreamDelta?: (fieldName: "content" | "reasoning_content", text: string) => void;
}

interface StreamAccumulator {
  content: string;
  reasoning_content: string;
}

@Injectable()
export class BamlCalibrationClient {
  private readonly providers: Record<StageProfile["provider"], ProviderConfig> = {
    moonshot: {
      apiKeyEnv: "MOONSHOT_API_KEY",
      baseUrlEnv: "MOONSHOT_BASE_URL",
      defaultBaseUrl: "https://api.moonshot.ai/v1"
    },
    "z-ai": {
      apiKeyEnv: "ZAI_API_KEY",
      baseUrlEnv: "Z_AI_BASE_URL",
      defaultBaseUrl: "https://api.z.ai/api/paas/v4"
    }
  };

  async smokeTestStage(stageName: "translation" | "review" | "repair", stage: StageProfile): Promise<void> {
    const options = this.buildRuntimeOptions(stageName, stage);
    const response = await b.SmokeTestCalibrationStage(stageName, options);
    if (!response.trim().toUpperCase().startsWith("OK")) {
      throw new Error(
        `Provider smoke test failed for stage '${stageName}' (${stage.provider}/${stage.model}): unexpected response '${response.trim()}'`
      );
    }
  }

  async translate(input: TranslateExecutionInput): Promise<BaseExecutionResult<string>> {
    this.assertPromptBundleSupported(input.promptBundleId);
    const options = this.buildRuntimeOptions("translation", input.stage);
    const request = input.stream
      ? await b.streamRequest.TranslateCalibrationSlice(
          input.runId,
          input.sliceId,
          input.sliceTitle,
          input.selectionRationale,
          input.sourceExcerpt,
          input.glossaryTerms,
          input.styleGuide,
          options
        )
      : await b.request.TranslateCalibrationSlice(
          input.runId,
          input.sliceId,
          input.sliceTitle,
          input.selectionRationale,
          input.sourceExcerpt,
          input.glossaryTerms,
          input.styleGuide,
          options
        );

    const messages = this.extractPromptMessages(request);
    const prompt = this.extractPrompt(messages);
    const value = await b.TranslateCalibrationSlice(
      input.runId,
      input.sliceId,
      input.sliceTitle,
      input.selectionRationale,
      input.sourceExcerpt,
      input.glossaryTerms,
      input.styleGuide,
      input.stream ? { ...options, onTick: this.createStreamTickHandler(input.onStreamDelta) } : options
    );

    return this.buildExecutionResult({
      log: options.collector.last,
      request,
      promptBundleId: input.promptBundleId,
      functionName: "TranslateCalibrationSlice",
      value
    });
  }

  async repair(input: RepairExecutionInput): Promise<BaseExecutionResult<string>> {
    this.assertPromptBundleSupported(input.promptBundleId);
    const options = this.buildRuntimeOptions("repair", input.stage);
    const request = await b.request.RepairCalibrationDraft(
      input.runId,
      input.sliceId,
      input.repairRound,
      input.currentDraft,
      input.hardDefectsJson,
      options
    );
    const value = await b.RepairCalibrationDraft(
      input.runId,
      input.sliceId,
      input.repairRound,
      input.currentDraft,
      input.hardDefectsJson,
      input.stream ? { ...options, onTick: this.createStreamTickHandler(input.onStreamDelta) } : options
    );

    return this.buildExecutionResult({
      log: options.collector.last,
      request,
      promptBundleId: input.promptBundleId,
      functionName: "RepairCalibrationDraft",
      value
    });
  }

  async review(input: ReviewExecutionInput): Promise<BaseExecutionResult<CalibrationReview>> {
    this.assertPromptBundleSupported(input.promptBundleId);
    const options = this.buildRuntimeOptions("review", input.stage);
    const request = await b.request.ReviewCalibrationSlice(
      input.runId,
      input.sliceId,
      input.sliceTitle,
      input.sourceExcerpt,
      input.translationOutput,
      input.glossaryTerms,
      input.styleGuide,
      input.rubric,
      options
    );
    const value = await b.ReviewCalibrationSlice(
      input.runId,
      input.sliceId,
      input.sliceTitle,
      input.sourceExcerpt,
      input.translationOutput,
      input.glossaryTerms,
      input.styleGuide,
      input.rubric,
      input.stream ? { ...options, onTick: this.createStreamTickHandler(input.onStreamDelta) } : options
    );

    return this.buildExecutionResult({
      log: options.collector.last,
      request,
      promptBundleId: input.promptBundleId,
      functionName: "ReviewCalibrationSlice",
      value
    });
  }

  private buildRuntimeOptions(stageName: string, stage: StageProfile): {
    clientRegistry: ClientRegistry;
    collector: Collector;
  } {
    const provider = this.providers[stage.provider];
    if (!provider) {
      throw new Error(`Unsupported provider '${stage.provider}'.`);
    }

    const apiKey = process.env[provider.apiKeyEnv];
    if (!apiKey) {
      throw new Error(
        `Missing API key for provider '${stage.provider}'. Set ${provider.apiKeyEnv} in the environment or .env.`
      );
    }

    const clientName = `runtime-${stageName}-${stage.provider}-${stage.model}`;
    const baseUrl = (process.env[provider.baseUrlEnv] ?? provider.defaultBaseUrl).replace(/\/+$/u, "");
    const options: Record<string, unknown> = {
      api_key: apiKey,
      base_url: baseUrl,
      model: stage.model,
      temperature: stage.temperature,
      finish_reason_deny_list: ["engine_overloaded"]
    };

    if (stage.max_tokens !== undefined) {
      options.max_tokens = stage.max_tokens;
    }

    if (stage.timeout_seconds !== undefined) {
      options.http = {
        request_timeout_ms: stage.timeout_seconds * 1000
      };
    }

    const clientRegistry = new ClientRegistry();
    clientRegistry.addLlmClient(clientName, "openai-generic", options, "CalibrationNetworkRetry");
    clientRegistry.setPrimary(clientName);

    return {
      clientRegistry,
      collector: new Collector(clientName)
    };
  }

  private buildExecutionResult<TValue>(input: {
    log: FunctionLog | null;
    request: HTTPRequest;
    promptBundleId: string;
    functionName: string;
    value: TValue;
  }): BaseExecutionResult<TValue> {
    const messages = this.extractPromptMessages(input.request);
    return {
      value: input.value,
      messages,
      prompt: this.extractPrompt(messages),
      promptFiles: {
        baml_bundle: input.promptBundleId,
        baml_clients: "baml_src/clients.baml",
        baml_function_source: "baml_src/calibration.baml",
        baml_function: input.functionName
      },
      response: this.serializeCollectorResponse(input.request, input.log),
      finishReason: input.log ? this.extractFinishReason(input.log) : undefined,
      usage: input.log ? this.extractUsage(input.log) : undefined
    };
  }

  private assertPromptBundleSupported(promptBundleId: string): void {
    if (promptBundleId !== "baseline-v1") {
      throw new Error(`Unsupported BAML prompt bundle '${promptBundleId}'. Only 'baseline-v1' is configured.`);
    }
  }

  private createStreamTickHandler(
    onStreamDelta?: (fieldName: "content" | "reasoning_content", text: string) => void
  ): ((reason: "Unknown", log: FunctionLog | null) => void) | undefined {
    if (!onStreamDelta) {
      return undefined;
    }

    const accumulator: StreamAccumulator = { content: "", reasoning_content: "" };
    return (_reason, log) => {
      const next = this.collectStreamText(log);
      for (const fieldName of ["reasoning_content", "content"] as const) {
        const current = next[fieldName];
        const previous = accumulator[fieldName];
        if (current.length > previous.length && current.startsWith(previous)) {
          const delta = current.slice(previous.length);
          if (delta) {
            onStreamDelta(fieldName, delta);
          }
        }
        accumulator[fieldName] = current;
      }
    };
  }

  private collectStreamText(log: FunctionLog | null): StreamAccumulator {
    const streamCall = this.asStreamCall(this.getSelectedCall(log));
    const output: StreamAccumulator = { content: "", reasoning_content: "" };
    for (const response of streamCall?.sseResponses() ?? []) {
      const payload = response.json();
      if (!payload || typeof payload !== "object") {
        continue;
      }
      const choices = (payload as Record<string, unknown>).choices;
      if (!Array.isArray(choices)) {
        continue;
      }
      for (const choice of choices) {
        if (!choice || typeof choice !== "object") {
          continue;
        }
        const delta = (choice as Record<string, unknown>).delta;
        if (!delta || typeof delta !== "object") {
          continue;
        }
        const deltaRecord = delta as Record<string, unknown>;
        if (typeof deltaRecord.content === "string") {
          output.content += deltaRecord.content;
        }
        if (typeof deltaRecord.reasoning_content === "string") {
          output.reasoning_content += deltaRecord.reasoning_content;
        }
      }
    }
    return output;
  }

  private extractPromptMessages(request: HTTPRequest): PromptMessage[] {
    const body = this.safeJson(request.body) as { messages?: Array<Record<string, unknown>> } | null;
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    return rawMessages.flatMap((message) => {
      if (!message || typeof message !== "object") {
        return [];
      }
      const role = typeof message.role === "string" ? message.role : "";
      if (role !== "system" && role !== "user" && role !== "assistant") {
        return [];
      }
      const content = this.extractTextContent((message as Record<string, unknown>).content);
      if (!content) {
        return [];
      }
      return [{ role, content }];
    });
  }

  private extractPrompt(messages: PromptMessage[]): { system: string; user: string } {
    return {
      system: messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n\n")
        .trim(),
      user: messages
        .filter((message) => message.role === "user")
        .map((message) => message.content)
        .join("\n\n")
        .trim()
    };
  }

  private extractTextContent(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }
    if (!Array.isArray(content)) {
      return "";
    }
    return content
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => (item.type === "text" && typeof item.text === "string" ? item.text : ""))
      .filter(Boolean)
      .join("\n");
  }

  private serializeCollectorResponse(request: HTTPRequest, log: FunctionLog | null): Record<string, unknown> {
    const selectedCall = this.getSelectedCall(log);
    return {
      request: this.serializeHttpRequest(request),
      raw_llm_response: log?.rawLlmResponse ?? null,
      timing: log ? this.serializeTiming(log.timing) : null,
      usage: log ? this.extractUsage(log) ?? null : null,
      finish_reason: log ? this.extractFinishReason(log) ?? null : null,
      selected_call: selectedCall ? this.serializeCall(selectedCall) : null,
      calls: log ? log.calls.map((call) => this.serializeCall(call)) : []
    };
  }

  private serializeCall(call: LlmCall | LlmStreamCall): Record<string, unknown> {
    const streamCall = this.asStreamCall(call);
    return {
      client_name: call.clientName,
      provider: call.provider,
      selected: call.selected,
      timing: this.serializeTiming(call.timing),
      usage: this.serializeUsage(call.usage),
      http_request: call.httpRequest ? this.serializeHttpRequest(call.httpRequest) : null,
      http_response: call.httpResponse ? this.serializeHttpResponse(call.httpResponse) : null,
      sse_responses: streamCall ? (streamCall.sseResponses() ?? []).map((response: { text: string }) => response.text) : null
    };
  }

  private serializeHttpRequest(request: HTTPRequest): Record<string, unknown> {
    return {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: {
        text: this.safeText(request.body),
        json: this.safeJson(request.body)
      }
    };
  }

  private serializeHttpResponse(response: HTTPResponse): Record<string, unknown> {
    return {
      status: response.status,
      headers: response.headers,
      body: {
        text: this.safeText(response.body),
        json: this.safeJson(response.body)
      }
    };
  }

  private serializeTiming(timing: Timing | undefined | null): Record<string, number | null> | null {
    if (!timing) {
      return null;
    }
    return {
      start_time_utc_ms: timing.startTimeUtcMs,
      duration_ms: timing.durationMs
    };
  }

  private serializeUsage(usage: Usage | null): Record<string, number> | null {
    if (!usage) {
      return null;
    }

    const normalized: Record<string, number> = {};
    if (usage.inputTokens !== null) {
      normalized.input_tokens = usage.inputTokens;
    }
    if (usage.outputTokens !== null) {
      normalized.output_tokens = usage.outputTokens;
    }
    if (usage.cachedInputTokens !== null) {
      normalized.cached_input_tokens = usage.cachedInputTokens;
    }
    return Object.keys(normalized).length > 0 ? normalized : null;
  }

  private extractUsage(log: FunctionLog): Record<string, number> | undefined {
    const normalized: Record<string, number> = {};
    if (log.usage.inputTokens !== null) {
      normalized.prompt_tokens = log.usage.inputTokens;
    }
    if (log.usage.outputTokens !== null) {
      normalized.completion_tokens = log.usage.outputTokens;
    }
    if (log.usage.inputTokens !== null || log.usage.outputTokens !== null) {
      normalized.total_tokens = (log.usage.inputTokens ?? 0) + (log.usage.outputTokens ?? 0);
    }
    if (log.usage.cachedInputTokens !== null) {
      normalized.cached_tokens = log.usage.cachedInputTokens;
    }

    const rawUsage = this.extractRawUsage(this.getSelectedCall(log));
    if (typeof rawUsage?.prompt_tokens === "number") {
      normalized.prompt_tokens = rawUsage.prompt_tokens;
    }
    if (typeof rawUsage?.completion_tokens === "number") {
      normalized.completion_tokens = rawUsage.completion_tokens;
    }
    if (typeof rawUsage?.total_tokens === "number") {
      normalized.total_tokens = rawUsage.total_tokens;
    }

    const promptDetails = rawUsage?.prompt_tokens_details as Record<string, unknown> | undefined;
    if (promptDetails && typeof promptDetails.cached_tokens === "number") {
      normalized.cached_tokens = promptDetails.cached_tokens;
    }

    const completionDetails = rawUsage?.completion_tokens_details as Record<string, unknown> | undefined;
    if (completionDetails && typeof completionDetails.reasoning_tokens === "number") {
      normalized.reasoning_tokens = completionDetails.reasoning_tokens;
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  private extractFinishReason(log: FunctionLog): string | undefined {
    const rawUsage = this.extractRawCallJson(this.getSelectedCall(log));
    const direct = rawUsage?.choices;
    if (Array.isArray(direct)) {
      const finishReason = direct[0]?.finish_reason;
      if (typeof finishReason === "string") {
        return finishReason;
      }
    }

    const streamCall = this.asStreamCall(this.getSelectedCall(log));
    const sse = streamCall?.sseResponses() ?? [];
    for (let index = sse.length - 1; index >= 0; index -= 1) {
      const payload = sse[index]?.json();
      if (!payload || typeof payload !== "object") {
        continue;
      }
      const choices = (payload as Record<string, unknown>).choices;
      if (Array.isArray(choices)) {
        const finishReason = (choices[0] as Record<string, unknown> | undefined)?.finish_reason;
        if (typeof finishReason === "string") {
          return finishReason;
        }
      }
    }

    return undefined;
  }

  private extractRawUsage(call: LlmCall | LlmStreamCall | null): Record<string, unknown> | null {
    const payload = this.extractRawCallJson(call);
    if (!payload || typeof payload.usage !== "object" || payload.usage === null) {
      return null;
    }
    return payload.usage as Record<string, unknown>;
  }

  private extractRawCallJson(call: LlmCall | LlmStreamCall | null): Record<string, unknown> | null {
    if (!call) {
      return null;
    }

    if (call.httpResponse) {
      const payload = this.safeJson(call.httpResponse.body);
      return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    }

    const streamCall = this.asStreamCall(call);
    const sse = streamCall?.sseResponses() ?? [];
    for (let index = sse.length - 1; index >= 0; index -= 1) {
      const payload = sse[index]?.json();
      if (payload && typeof payload === "object") {
        return payload as Record<string, unknown>;
      }
    }

    return null;
  }

  private getSelectedCall(log: FunctionLog | null): LlmCall | LlmStreamCall | null {
    if (!log) {
      return null;
    }
    const selected = log.selectedCall as LlmCall | LlmStreamCall | null | undefined;
    if (selected) {
      return selected;
    }
    return log.calls.at(-1) ?? null;
  }

  private asStreamCall(call: LlmCall | LlmStreamCall | null): LlmStreamCall | null {
    if (!call) {
      return null;
    }
    return typeof (call as LlmStreamCall).sseResponses === "function" ? (call as LlmStreamCall) : null;
  }

  private safeJson(body: { json(): unknown }): unknown {
    try {
      return body.json();
    } catch {
      return null;
    }
  }

  private safeText(body: { text(): string }): string | null {
    try {
      return body.text();
    } catch {
      return null;
    }
  }
}
