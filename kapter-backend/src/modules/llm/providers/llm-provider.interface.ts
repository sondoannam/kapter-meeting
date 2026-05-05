export type LlmProviderName = "openai" | "gemini" | "ollama";
export type LlmProviderHealthCheckStatus = "ok" | "error" | "not_configured";
export type LlmProviderAuthStatus =
  | "valid"
  | "invalid"
  | "unknown"
  | "not_configured"
  | "not_applicable";

export interface LlmProviderHealthStatus {
  provider: LlmProviderName;
  status: LlmProviderHealthCheckStatus;
  configured: boolean;
  authStatus: LlmProviderAuthStatus;
  model?: string;
  endpoint?: string;
  latencyMs?: number;
  requestId?: string;
  message?: string;
  code?: string;
}

export interface GenerateJsonProviderRequest {
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  systemPrompt: string;
  userPrompt: string;
}

export interface LlmProvider {
  readonly name: LlmProviderName;
  isConfigured(): boolean;
  generateJson(request: GenerateJsonProviderRequest): Promise<unknown>;
}
