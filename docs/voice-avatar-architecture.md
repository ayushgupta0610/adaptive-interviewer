# Voice + Avatar Architecture (WebRTC · LiveKit · ElevenLabs · Simli)

How the real-time voice interview works, and how a talking-head avatar plugs in.

## The blocks

| Block | What it is | Its job |
|---|---|---|
| **WebRTC** | A browser standard for real-time audio/video/data | The low-latency "language" media is streamed in (sub-second) |
| **LiveKit** | Open-source infrastructure built on WebRTC (media server + SDKs) | The "room": every party joins it; it **routes** each audio/video track between participants and handles scale, NAT traversal, reconnects |
| **ElevenLabs agent** | Managed conversational voice AI | The **brain + voice**: speech-to-text → turn-taking → LLM → text-to-speech |
| **Simli** | Real-time avatar API | The **face**: audio in → **lip-synced talking-head video** out |

**Mental model:** WebRTC is the *language*. LiveKit is the *room + router*. ElevenLabs is the
*brain + voice*. Simli is the *face*. The human, the voice-AI, and the avatar are all just
**participants exchanging tracks**.

**WebRTC vs LiveKit (commonly confused):** WebRTC is the raw standard (signaling, TURN, an SFU to
fan out tracks — hard to run at scale). LiveKit is a production implementation of all that. Our
ElevenLabs agent already runs over LiveKit under the hood (its connection config carries a
`livekitUrl`).

## How they come together

```
       CANDIDATE                      LIVEKIT                       ELEVENLABS AGENT
       (browser)                  (WebRTC media room)                   (cloud)
   ┌───────────────┐          ┌──────────────────────┐          ┌─────────────────────┐
   │ 🎤 mic         │ ──audio──►                      │ ──audio──► STT → turn-taking    │
   │ 🔊 speaker     │ ◄─audio── │  SFU media router:   │ ◄─audio── │  → LLM → TTS        │
   │ 📷 webcam      │          │  forwards each track │          └──────────┬──────────┘
   │ 🧑 avatar<video>│ ◄─video── │  between every       │ ◄─video──┐          │ TTS audio
   └───────────────┘          │  participant         │          │          ▼
                              └──────────────────────┘          │   ┌──────────────┐
                                                                 └───│ SIMLI         │
                                                                     │ audio → face  │
                                                                     │ video         │
                                                                     └──────────────┘
```

## One turn, step by step

1. **Candidate speaks** → browser publishes a mic **audio track** over WebRTC.
2. **LiveKit forwards** that audio to the ElevenLabs agent.
3. **ElevenLabs loop:** Scribe **STT** → **turn-taking** (decides you finished) → **LLM** (Claude
   Haiku) → **TTS** (Flash).
4. **TTS audio fans out** to the candidate's **speaker** and into **Simli**.
5. **Simli lip-syncs** the audio into a talking-head **video** in real time.
6. **LiveKit routes** that video to the browser's `<video>`. Audio + video stay in sync (shared timeline).
7. Webcam recording is local and separate (doesn't need the room).

## Two ways to add the face

### Pattern A — keep ElevenLabs managed, add Simli client-side (what we built)
- The ElevenLabs agent stays the orchestrator (its turn-taking + voice).
- We tap the agent's output audio via the SDK's **`onAudio`** callback (base64 chunks; fires in
  **websocket** connection mode), decode it, and push it to **`SimliClient.sendAudioData()`**.
- ElevenLabs' own playback is **muted** (`setVolume({volume:0})`) so Simli is the single A/V source
  (keeps lip-sync aligned).
- Smallest change; Simli is a front-end add-on. Feature-flagged via `NEXT_PUBLIC_SIMLI_*`.
- **Verify on first live run:** (1) `onAudio` fires in your session/transport; (2) the agent's
  output audio is PCM16 @ 16 kHz mono (what Simli expects) — if not, resample before `sendAudioData`.

### Pattern B — LiveKit Agents as orchestrator (scale/control)
- You assemble the pipeline yourself in a LiveKit room: LiveKit Agents + ElevenLabs (STT/TTS
  plugins) + your LLM + **Simli's LiveKit plugin** (subscribes to the TTS audio track).
- Most control and the cleanest multi-participant wiring, but you take over turn-taking and lose
  ElevenLabs' managed convenience. Worth it at scale.

## Cost note
Per-minute costs **stack**: LiveKit (transport, cheap) + ElevenLabs (~$0.10/min, the big one) +
Simli (avatar video, another per-minute charge). Adding a face roughly *adds* a per-minute cost on
top of voice — reserve it for the premium experience.

## Where it lives in this repo
- Voice runtime: `src/components/VoiceInterview.tsx` (ElevenLabs `useConversation`).
- Avatar: `src/components/SimliAvatar.tsx` (Pattern A), gated on `NEXT_PUBLIC_SIMLI_API_KEY` +
  `NEXT_PUBLIC_SIMLI_FACE_ID`. Off by default.
- Setup: see `.env.example` (Simli section).
