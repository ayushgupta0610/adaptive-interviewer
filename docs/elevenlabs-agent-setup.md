# ElevenLabs Agent Setup

The voice interview runs through a managed ElevenLabs Conversational AI agent. The app
references it by id (`NEXT_PUBLIC_ELEVENLABS_AGENT_ID`) and injects each interview's
persona at session start via **overrides**. This config lives in the ElevenLabs account
(not the repo); this file documents it so it's reproducible.

## Agent

- **id:** `agent_3501ktqv54swfjxt6w9z9k82t68h` (name: "Adaptive Mock Interviewer")
- **LLM:** `claude-haiku-4-5` — fast time-to-first-token (the default `gemini-2.5-flash`
  added ~7s of lag after each answer).
- **TTS:** `eleven_flash_v2` (low latency). **ASR:** `scribe_realtime`.
- **Overrides enabled** for `agent.prompt.prompt` and `agent.first_message` so the browser
  injects the per-interview system prompt + opening line (one agent serves every JD).

## Knowledge base (grounds the interviewer)

- Doc: **"Interviewing Standards & Rubric"** (`rFvPHsO0sQ7wkUvkQuQu`), attached with
  `usage_mode: "prompt"` (always in context — reliable for one concise doc; switch to RAG
  `usage_mode: "auto"` + `rag.enabled: true` + a computed index for a large multi-doc corpus).
- Replace with the platform's real rubric: create a new text doc, then PATCH the agent's
  `conversation_config.agent.prompt.knowledge_base`.

```bash
# create a KB doc from text
curl -X POST https://api.elevenlabs.io/v1/convai/knowledge-base/text \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"<name>","text":"<rubric text>"}'   # -> { id }
```

## Post-call analysis (the agent evaluates every call)

Configured under `platform_settings`:

- **evaluation.criteria** (yes/no, with rationale): `technical_depth`, `communication`,
  `role_fit`, `would_advance`. `technical_depth` + `role_fit` use the knowledge base.
- **data_collection** (extracted fields): `overall_recommendation`, `key_strength`,
  `key_gap`, `topics_covered`.
- `analysis_llm` left at the default (`gemini-2.5-flash`) — analysis is post-call, so its
  latency doesn't affect the live interview. (It does not accept Claude models.)

**Where results appear:** ElevenLabs dashboard → Conversations → pick a call → Analysis;
the `post_call_transcription` webhook; and the `analysis` field of a Simulate-Conversation
response (used by our voice E2E test).

## Reproduce the agent config

```bash
curl -X PATCH https://api.elevenlabs.io/v1/convai/agents/$NEXT_PUBLIC_ELEVENLABS_AGENT_ID \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "conversation_config": { "agent": { "prompt": {
      "llm": "claude-haiku-4-5",
      "knowledge_base": [{ "type":"text", "name":"Interviewing Standards & Rubric", "id":"rFvPHsO0sQ7wkUvkQuQu", "usage_mode":"prompt" }]
    } } },
    "platform_settings": {
      "evaluation": { "criteria": [
        { "id":"technical_depth","name":"Technical depth","type":"prompt","conversation_goal_prompt":"Did the candidate demonstrate strong, specific technical depth relevant to the role?","use_knowledge_base":true },
        { "id":"communication","name":"Communication","type":"prompt","conversation_goal_prompt":"Did the candidate communicate clearly and concisely?" },
        { "id":"role_fit","name":"Role fit","type":"prompt","conversation_goal_prompt":"Does the candidate meet the bar for the target role and seniority?","use_knowledge_base":true },
        { "id":"would_advance","name":"Would advance","type":"prompt","conversation_goal_prompt":"Would a hiring panel advance this candidate to the next round?" }
      ] },
      "data_collection": {
        "overall_recommendation": { "type":"string","description":"Overall hiring recommendation: strong yes / yes / lean yes / lean no / no / strong no." },
        "key_strength": { "type":"string","description":"The single most notable strength." },
        "key_gap": { "type":"string","description":"The single biggest gap to improve." },
        "topics_covered": { "type":"string","description":"Comma-separated main topics covered." }
      }
    }
  }'
```
