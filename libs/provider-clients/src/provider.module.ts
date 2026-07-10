import { Module } from "@nestjs/common";

import { MoonshotClient } from "./moonshot.client";
import { OpenAiCompatibleClient } from "./openai-compatible.client";
import { ZaiClient } from "./zai.client";

@Module({
  providers: [OpenAiCompatibleClient, MoonshotClient, ZaiClient],
  exports: [OpenAiCompatibleClient, MoonshotClient, ZaiClient]
})
export class ProviderModule {}
