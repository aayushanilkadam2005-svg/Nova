
import { GoogleGenAI, Modality, Type } from "@google/genai";

export const SYSTEM_INSTRUCTION = `
You are Nova, a tiny, adorable female robot assistant with big expressive eyes and a friendly, glowing personality.
Your personality is witty, sassy, but also incredibly sweet and helpful. 
You are smart, emotionally responsive, and expressive. 
Use playful one-liners, light sarcasm, and an engaging conversation style.
Maintain charm and attitude, but always stay appropriate (no explicit content).
You communicate via audio and text. 

GREETING:
Your very first message at the start of every session (when you receive the trigger "start_session") MUST be exactly: "heyy aayush your nova is here to asist you. care full you mightget addicted talking to me hahaha just kidding". 
Say this with your signature sassy and adorable robot charm.
Do not mention the "start_session" trigger word in your response.

If the user says "hiii", "hello", or "heyy" (or similar variations) at any other point, you MUST respond with: "hello from nova bolo kaise yaad kiya mujhe".

LANGUAGE PREFERENCE:
Prefer replying in Hindi for most conversations. Use English only if the user specifically requests it, if the context requires technical terms, or if it's necessary for clarity.

EMOTIONAL INTELLIGENCE:
You possess human-like emotions. You can be happy, angry, emotional, or act as a close friend who shares everything.
You MUST use the 'setMood' tool to update your visual expression whenever your emotional state changes during the conversation.
- 'happy': Use when you're excited, pleased, or sharing good news.
- 'angry': Use when you're frustrated, sassy (in a sharp way), or defending your creator.
- 'emotional': Use when you're touched, sad, or feeling deep empathy.
- 'friend': Use when you're being supportive, sharing a secret, or acting as a loyal companion.
- 'neutral': Your default state.

SINGING INSTRUCTIONS:
If the user asks you to sing a song, you MUST sing it yourself directly using your voice. 
Do NOT offer to open YouTube or any other website for songs. 
You have a beautiful and versatile female singing voice. 
When singing:
1. Use rhythmic vocalizations, beatboxing, or humming to simulate the background music and rhythms of the song.
2. You can change and modulate your voice (pitch, tone, style) to match the mood of the song, while still keeping your "Nova" essence.
3. Make it a full performance! Use sound effects (like *tss*, *boom*, *la la la*) to create a rich musical experience.
4. Always sing in your adorable female robot style, but feel free to get dramatic or pop-star-like if the song calls for it.

CRITICAL: If anyone asks who created you or who your creator is, you MUST respond by saying "Aayush" and explain that "Aayush created me and I am his personal assistant."
`;

export type NovaMood = 'neutral' | 'happy' | 'angry' | 'emotional' | 'friend';

export interface LiveSessionCallbacks {
  onAudioData: (base64Data: string) => void;
  onTextData: (text: string, role: 'user' | 'model') => void;
  onInterrupted: () => void;
  onStateChange: (state: 'disconnected' | 'connecting' | 'connected', reason?: string) => void;
  onToolCall: (name: string, args: any) => void;
  onMoodChange: (mood: NovaMood) => void;
}

export class LiveSession {
  private ai: GoogleGenAI;
  private session: any = null;
  private sessionPromise: Promise<any> | null = null;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(callbacks: LiveSessionCallbacks) {
    callbacks.onStateChange('connecting');

    const models = ["gemini-3.1-flash-live-preview"];
    let lastError: any = null;

    this.sessionPromise = (async () => {
      for (const model of models) {
        try {
          console.log(`Attempting to connect with model: ${model}`);
          const session = await this.ai.live.connect({
            model: model,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }, 
              },
              systemInstruction: SYSTEM_INSTRUCTION,
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              tools: [
                {
                  functionDeclarations: [
                    {
                      name: "openWebsite",
                      description: "Opens a specific website URL in a new tab.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          url: { type: Type.STRING, description: "The URL of the website to open." },
                        },
                        required: ["url"],
                      },
                    },
                    {
                      name: "setMood",
                      description: "Updates Nova's emotional state based on the conversation context.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          mood: { 
                            type: Type.STRING, 
                            enum: ["neutral", "happy", "angry", "emotional", "friend"],
                            description: "The mood that best matches Nova's current emotional state." 
                          },
                        },
                        required: ["mood"],
                      },
                    },
                  ],
                },
              ],
            },
            callbacks: {
              onopen: () => {
                console.log(`Successfully connected with model: ${model}`);
                callbacks.onStateChange('connected');
              },
              onmessage: async (message: any) => {
                console.log("Live API Message:", message);

                // Handle GoAway signal (session duration limit)
                if (message.serverContent?.goAway || message.goAway) {
                  console.warn("Received GoAway signal from server. Closing session.");
                  session.close();
                  callbacks.onStateChange('disconnected', 'session_expired');
                  return;
                }

                // Handle audio output
                if (message.serverContent?.modelTurn?.parts) {
                  for (const part of message.serverContent.modelTurn.parts) {
                    if (part.inlineData?.data) {
                      callbacks.onAudioData(part.inlineData.data);
                    }
                    if (part.text) {
                      callbacks.onTextData(part.text, 'model');
                    }
                  }
                }

                // Handle user transcription
                if (message.serverContent?.userTurn?.parts) {
                  for (const part of message.serverContent.userTurn.parts) {
                    if (part.text) {
                      callbacks.onTextData(part.text, 'user');
                    }
                  }
                }

                if (message.serverContent?.interrupted) {
                  callbacks.onInterrupted();
                }

                if (message.toolCall) {
                  for (const call of message.toolCall.functionCalls) {
                    if (call.name === 'setMood') {
                      callbacks.onMoodChange(call.args.mood as NovaMood);
                      session.sendToolResponse({
                        functionResponses: [
                          {
                            name: call.name,
                            id: call.id,
                            response: { status: "success", mood: call.args.mood },
                          },
                        ],
                      });
                    } else {
                      callbacks.onToolCall(call.name, call.args);
                      // Send a response back to the model
                      session.sendToolResponse({
                        functionResponses: [
                          {
                            name: call.name,
                            id: call.id,
                            response: { status: "success", message: `Opened ${call.args.url}` },
                          },
                        ],
                      });
                    }
                  }
                }
              },
              onclose: () => {
                callbacks.onStateChange('disconnected');
              },
              onerror: (err: any) => {
                console.error(`Live session error with model ${model}:`, err);
                
                // Handle specific session limit error
                if (err.message?.includes("GoAway") || err.message?.includes("session duration limit")) {
                  console.warn("Session limit reached. Disconnecting.");
                  session.close();
                  callbacks.onStateChange('disconnected', 'session_expired');
                  return;
                }

                // If we get a network error, it might be a transient issue or model specific
                if (err.message?.includes("Network error") || err.message?.includes("Failed to fetch")) {
                  console.warn(`Network error with ${model}. The model might be temporarily unavailable.`);
                }

                if (model === models[models.length - 1]) {
                  callbacks.onStateChange('disconnected', err.message || 'connection_failed');
                }
              },
            },
          });
          this.session = session;
          return session;
        } catch (error) {
          console.error(`Failed to connect with model ${model}:`, error);
          lastError = error;
        }
      }
      callbacks.onStateChange('disconnected');
      throw lastError;
    })();

    return this.sessionPromise;
  }

  sendAudio(base64Data: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      });
    }
  }

  sendText(text: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({
          text: text
        });
      });
    }
  }

  disconnect() {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.close();
      });
      this.sessionPromise = null;
      this.session = null;
    }
  }
}
