/**
 * Ambient types for the slides lab bundle (Mermaid CDN, legacy webkit STT).
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
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
    __kittenSlidesLabReady?: boolean;
  }

  var mermaid: MermaidGlobal | undefined;

  interface GlobalThis {
    mermaid?: MermaidGlobal;
  }
}
