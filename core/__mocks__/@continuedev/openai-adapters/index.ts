export class BaseLlmApi {}
export type ChatCompletionCreateParams = any;
export const constructLlmApi = () => ({
  chatCompletion: async () => {},
  completion: async () => {},
  streamChatCompletion: async function* () {},
  streamCompletion: async function* () {},
});
export const OpenAIAdapter = () => {};

export function extractBase64FromDataUrl(dataUrl: string): string {
  const parts = dataUrl.split(",");
  return parts.length > 1 ? parts[1] : dataUrl;
}

export function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  return { mimeType: "image/png", base64: dataUrl };
}
