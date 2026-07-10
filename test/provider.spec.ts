import { OpenAiCompatibleClient } from "@provider-clients";

describe("OpenAI-compatible client", () => {
  const client = new OpenAiCompatibleClient();
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.ZAI_API_KEY;
    delete process.env.MOONSHOT_API_KEY;
  });

  it("retries once on HTTP 429", async () => {
    process.env.ZAI_API_KEY = "test-key";
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response('{"error":{"message":"rate limit"}}', {
          status: 429,
          headers: { "Retry-After": "0" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    global.fetch = fetchMock as typeof global.fetch;

    const response = await client.createChatCompletion({
      providerName: "z-ai",
      model: "glm-5",
      messages: [{ role: "user", content: "Hello" }],
      temperature: 1,
      stream: false,
      maxRetries: 1
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.extractMessageText(response)).toBe("OK");
  });

  it("retries engine_overloaded responses", async () => {
    process.env.MOONSHOT_API_KEY = "test-key";
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "" }, finish_reason: "engine_overloaded" }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "Translated" }, finish_reason: "stop" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    global.fetch = fetchMock as typeof global.fetch;

    const response = await client.createChatCompletion({
      providerName: "moonshot",
      model: "kimi-k2.5",
      messages: [{ role: "user", content: "Translate" }],
      temperature: 1,
      stream: false,
      maxRetries: 1
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.extractMessageText(response)).toBe("Translated");
  });

  it("streams content deltas to the callback", async () => {
    process.env.MOONSHOT_API_KEY = "test-key";
    const chunks = [
      'data: {"id":"abc","created":1,"model":"kimi-k2.5","choices":[{"delta":{"role":"assistant","content":"Hel"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}],"usage":{"total_tokens":5}}\n\n',
      "data: [DONE]\n\n"
    ];
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      }
    });
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" }
      })
    );
    global.fetch = fetchMock as typeof global.fetch;
    const seen: string[] = [];

    const response = await client.createChatCompletion({
      providerName: "moonshot",
      stageName: "translation",
      model: "kimi-k2.5",
      messages: [{ role: "user", content: "Translate" }],
      temperature: 1,
      stream: true,
      onStreamDelta: (_fieldName, text) => seen.push(text)
    });

    expect(client.extractMessageText(response)).toBe("Hello");
    expect(seen.join("")).toBe("Hello");
  });
});
