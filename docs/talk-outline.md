# kitten-tts @ Vilnius.js — speaker outline

Print-friendly cheat sheet: **what to say** and **how long** per slide. On-screen titles and bullets match the deck; **Presenter notes** are the main script hints from the source deck.

---

## Slide 1 — Title · ~1 min  
**Section:** (title only)  
**On screen:** *kitten-tts: Real-time TTS on (almost) anything*  

**Aim:** Let the title land; name yourself, role, and Kiki as the live AI presenter.

**Say / do:**
- Optional: one short beat if you point at Kiki’s voice — then advance when ready.

**Kiki (if she speaks):** At most one short in-character line; don’t read an agenda unprompted.

---

## Slide 2 — Vilnius.js opening · ~2 min  
**On screen:** *Tonight: a port, LLM leverage, and a deck that demos itself.*

**Takeaway:** The talk is both the project story and a live demo of the stack.

**Say / do:**
- Open with the room; set three anchors: **JS port**, **LLM-assisted build loop**, **this deck as live demo** (KittenTTS + STT + LLM).
- Bullets on slide: port TTS into JS/browser; LLMs for speed, not garnish; talk = live system that speaks, listens, answers.

**Optional prompt for the room:** *What part of the project genuinely needed LLM help instead of normal engineering?*

**Artifacts:** kitten-tts-js · LLM-assisted build loop · Live browser deck  

---

## Slide 3 — Why port it · ~2 min  
**On screen:** *I wanted KittenTTS in JavaScript because the browser is where the interesting demos live.*

**Takeaway:** The port matters because it moves TTS into the environments JS developers actually use.

**Say / do:**
- Origin story: **portability, hackability, browser demos** — not “another port for fun.”
- Node is useful; the **browser** is where instant demos, shareable repros, and weird UI experiments live.

**Optional prompt:** *Why not keep the original runtime and call it from JavaScript?*

**Artifacts:** Browser runtime · Node runtime · Portable demo surface  

---

## Slide 4 — LLM leverage · ~2 min  
**On screen:** *LLMs were most useful as acceleration on ugly engineering edges.*

**Takeaway:** LLMs helped most where iteration speed mattered, not where trust could be outsourced.

**Say / do:**
- Be honest: the model didn’t “build the project” — it cut friction on **ONNX quirks, TS cleanup, browser runtime, tests, docs**.
- Emphasize **verify every runtime claim** yourself.

**Optional prompt:** *Where did LLM advice save time, and where did it mislead you?*

**Artifacts:** TypeScript refactors · Runtime debugging · Docs and test support  

---

## Slide 5 — Live stack · ~2 min  
**On screen:** *The demo stack is simple on purpose: KittenTTS + browser STT + an LLM.*

**Takeaway:** The deck is the orchestration layer for all three channels.

**Say / do:**
- Make the stack **diagram-simple**: **reason → speak → hear → (score)**.
- KittenTTS = output; browser STT = input + listen-back hooks; LLM = grounded in **slide context** via an adapter.

**Optional prompt:** *Why keep everything in the deck instead of splitting into separate tools?*

**Artifacts:** KittenTTS worker · Browser STT · Slide-aware LLM adapter  

---

## Slide 6 — Reinforcement loop · ~3 min  
**On screen:** *The main idea is a reinforcement cycle: the system listens to what KittenTTS actually said.*

**Takeaway:** Optimize for what reaches human ears, not only what exists as text.

**Say / do:**
- **Core idea — slow down:** prompt → answer → **speech** → **hearing** → scoring → iteration.
- Text-only checks miss drift that only shows up in **audio**.

**Optional prompt:** *Why is hearing the audio back better than just checking the generated text?*

**Artifacts:** LLM answer · KittenTTS audio · Whisper-style transcript  

---

## Slide 7 — Audio correctness · ~2 min  
**On screen:** *Evaluating the audio channel is different from evaluating the text channel.*

**Takeaway:** If the product is spoken output, correctness must be measured on spoken output.

**Say / do:**
- LLM text can be “fine” while **spoken** output fails: pronunciation, pacing, truncation, buffering, emphasis.
- This is why **transcript of what was actually said** matters.

**Optional prompt:** *What kinds of errors show up only when you evaluate the spoken answer?*

**Artifacts:** Audio transcript · Pronunciation drift · Delivery quality  

---

## Slide 8 — Scoring loop · ~2 min  
**On screen:** *Once Whisper hears the answer, the system can score what came out of the speaker.*

**Takeaway:** Spoken output becomes measurable input; the feedback loop gets stronger.

**Say / do:**
- Transcript = artifact → compare to **slide intent** → accept / revise / retry.
- Frame as **practical iteration**, not academic RL jargon.

**Optional prompt:** *What does the system do when the spoken answer fails the correctness check?*

**Artifacts:** Transcript scoring · Slide intent anchors · Retry or revise decision  

---

## Slide 9 — Live demo surface · ~2 min  
**On screen:** *That is why this talk runs inside a deck that can speak, listen, and answer.*

**Takeaway:** The talk UI is part of the demo, not just a container.

**Say / do:**
- The **deck is the proof**: narrate, audience asks, system answers **in the same UI**.
- Stage stays clean; presenter tools stay nearby; PTT / waveform / Kiki show **listen → think → speak**.

**Optional prompt:** *How much UI is enough before the demo distracts from the talk?*

**Artifacts:** Presenter notes · Push-to-talk · Waveform + copresenter  

---

## Slide 10 — Practical rubric · ~2 min  
**On screen:** *My quality bar became: grounded, speakable, and correct over the audio channel.*

**Takeaway:** Text quality alone is not enough for a spoken system.

**Say / do:**
- Three-part bar: **grounded in slide**, **speakable by TTS**, **still correct after listen-back**.
- Memorable and operational — this shaped the live demo.

**Optional prompt:** *How do you score “sounds good when spoken” without a vague rubric?*

**Artifacts:** Grounding checks · Speakability checks · Transcript checks  

---

## Slide 11 — Engineering lessons · ~2 min  
**On screen:** *The hard parts were orchestration, trust, and runtime weirdness.*

**Takeaway:** Reliability came from coordinating messy channels, not from one model choice.

**Say / do:**
- Vilnius.js angle: not “AI magic” — **predictable browser behavior** under a live talk.
- Pain at the seams: **model → TTS → playback → STT → slide state**; degradation paths; alignment.

**Optional prompt:** *What browser/runtime issue hurt most during the port?*

**Artifacts:** Capability checks · Fallback paths · Audio-state sync  

---

## Slide 12 — What is next · ~3 min  
**On screen:** *The architecture is now ready for stronger local models and better audio evaluation.*

**Takeaway:** Clear boundaries let you swap models and improve scoring without rewriting the demo.

**Say / do:**
- **Stable** stage/orchestration; **swap** LLM behind the adapter; **improve** listen-back scoring.
- Optimistic but honest — not “done,” but **ready to iterate**.

**Optional prompt:** *If browser models improve tomorrow, what changes first?*

**Artifacts:** Slide UI · LLM adapter · Audio evaluator  

---

## Slide 13 — Close · ~2 min  
**On screen:** *The real point is not just TTS in JS, but a feedback loop for spoken interfaces.*

**Takeaway:** Spoken systems improve when they can hear themselves and score what was delivered.

**Say / do:**
- Return to the title hook: portable TTS + **listen-back evaluation** as the deeper claim.
- Port enabled the loop; LLMs accelerated the build; **audio channel** is where product truth lives.

**Optional prompt:** *What would you build next if you focused purely on reinforcement and evaluation?*

**Artifacts:** Narration loop · Listen-back loop · Audio correctness  

---

## Slide 14 — Questions · as needed  
**On screen:** *Questions?*

**Takeaway:** Make space for the room.

**Say / do:**
- Pause; scan the room. If silence, offer one seed: ONNX vs WASM, or scoring spoken answers in production.
- Short, spoken-friendly answers; repeat unclear questions for the room.

**Optional prompt:** *What do you want to know that the talk didn’t cover?*

**Artifacts:** kitten-tts-js repo · This deck · Ollama + Kiki setup  

---

## Slide 15 — Thank you · ~1 min  
**On screen:** *Thank you*

**Takeaway:** Close warmly; point people at the project.

**Say / do:**
- Thanks; GitHub welcome; deck was LLM-assisted + dogfooded; enjoy the rest of Vilnius.js.
- Optional beat of silence before leaving fullscreen so applause can land.

**Kiki:** One warm closing line unless Algimantas asks more; thanks from both of you is OK in character.

**Artifacts:** GitHub: kitten-tts-js · Try the deck with `?debug=1`  

---

*Generated from `src/slides-lab-main.ts` (`deck` + `deckMeta`). Rebuild or edit there if slides change.*
