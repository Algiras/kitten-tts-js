/**
 * Ambient types for the slides presenter bundle (Mermaid CDN).
 */
export {};

type MermaidGlobal = {
  initialize: (opts: Record<string, unknown>) => void;
  render: (
    id: string,
    def: string,
  ) => Promise<{ svg: string; bindFunctions?: (el: Element) => void }>;
};

declare global {
  interface Window {
    __kittenSlidesLabReady?: boolean;
    /** Optional; used by `slides-web-llm-assistant.ts` when built standalone. */
    kittenSlidesWebLlm?: {
      connect: (baseUrl: string, modelId?: string, onStatus?: (msg: string) => void) => Promise<{ models: string[] }>;
      disconnect: () => void;
      isConnected: () => boolean;
      getModel: () => string;
      getBaseUrl: () => string;
      setModel: (m: string) => void;
      chat: (opts: Record<string, unknown>) => Promise<string>;
      getLastChatUsage: () => unknown;
    };
    /** Optional; used by `slides-ollama-assistant.ts`. */
    kittenSlidesOllama?: {
      connect: (url?: string, modelId?: string, onStatus?: (msg: string) => void) => Promise<{ models: string[] }>;
      disconnect: () => void;
      isConnected: () => boolean;
      getModel: () => string;
      getBaseUrl: () => string;
      setModel: (m: string) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chat: (opts: any) => Promise<string>;
      getLastChatUsage: () => unknown;
      setOllamaRequestHeaders: (h: Record<string, string> | null | undefined) => void;
    };
  }

  var mermaid: MermaidGlobal | undefined;

  interface GlobalThis {
    mermaid?: MermaidGlobal;
  }
}
