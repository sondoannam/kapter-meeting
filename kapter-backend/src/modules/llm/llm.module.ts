import { Module } from '@nestjs/common';

import { LlmService } from './llm.service';
import { GeminiLlmProvider } from './providers/gemini-llm.provider';
import { OllamaLlmProvider } from './providers/ollama-llm.provider';
import { OpenAiLlmProvider } from './providers/openai-llm.provider';

@Module({
  providers: [LlmService, OpenAiLlmProvider, GeminiLlmProvider, OllamaLlmProvider],
  exports: [LlmService],
})
export class LlmModule {}
