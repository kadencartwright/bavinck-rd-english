import { Injectable } from "@nestjs/common";

import { CreateChatCompletionParams, OpenAiCompatibleClient } from "./openai-compatible.client";

@Injectable()
export class ZaiClient {
  constructor(private readonly client: OpenAiCompatibleClient) {}

  createChatCompletion(params: Omit<CreateChatCompletionParams, "providerName">) {
    return this.client.createChatCompletion({ ...params, providerName: "z-ai" });
  }
}
