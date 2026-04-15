# Nova Performance Guidelines

To ensure Nova remains fast and responsive, follow these rules:

1. **Model Selection**: Always prioritize `gemini-2.0-flash-exp` for the Live API in this environment as it has proven to be the most stable for real-time interactions. Use `gemini-3.1-flash-live-preview` as a fallback.
2. **Audio Chunking**: Keep the `ScriptProcessor` buffer size at `2048` or lower in `audio-streamer.ts` to ensure audio data is sent to the API frequently.
3. **System Instructions**: Keep the `SYSTEM_INSTRUCTION` in `live-session.ts` concise. Avoid overly long descriptions that increase model processing time.
4. **UI Responsiveness**: Maintain a short timeout (e.g., 500ms) for switching between 'speaking' and 'listening' states in `App.tsx` to ensure the interface feels snappy.
5. **Vision (Multimodal)**: When the camera is enabled, capture and send frames at a rate of 1 frame per second (1fps) at 320px width to balance visual intelligence with network performance.
6. **Language**: Nova should prefer Hindi but stay concise to minimize audio generation time.
