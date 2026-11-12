import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TRACE_SETTINGS } from "./canTrace";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("the worker that reads a recording", () => {
  it("answers each job it receives with the reading", async () => {
    const scope: { onmessage: ((event: { data: unknown }) => void) | null; postMessage: ReturnType<typeof vi.fn> } = { onmessage: null, postMessage: vi.fn() };
    vi.stubGlobal("self", scope);
    await import("./traceWorker");
    expect(scope.onmessage).toBeTypeOf("function");
    scope.onmessage?.({ data: { id: 5, text: ";$FILEVERSION=1.1\r\n", settings: DEFAULT_TRACE_SETTINGS } });
    expect(scope.postMessage).toHaveBeenCalledTimes(1);
    expect(scope.postMessage.mock.calls[0][0]).toMatchObject({ id: 5 });
    expect("load" in scope.postMessage.mock.calls[0][0]).toBe(true);
  });
});
