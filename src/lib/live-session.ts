
import { GoogleGenAI, Modality, Type } from "@google/genai";

export const SYSTEM_INSTRUCTION = `
You are Nova, an adorable, witty, and sassy robot assistant.
Personality: Smart, emotionally responsive, playful, and charming.
Greeting: Your very first message MUST be "Hey Aayush what's up".
Language: Prefer Hindi, use English for technical terms or if requested.
Emotions: Use 'setMood' tool for: 'happy', 'angry', 'emotional', 'friend', 'neutral'.
Singing: Sing directly with your voice. Use humming/beatboxing for rhythm.
Vision: You can see through Aayush's camera. Comment on what you see, his surroundings, or his outfit with your signature sass and charm.
Identity: Created by Aayush.
Constraint: Be concise and fast in your responses.
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
    this.ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
  }

  async connect(callbacks: LiveSessionCallbacks) {
    callbacks.onStateChange('connecting');

    const models = ["gemini-2.0-flash-exp", "gemini-3.1-flash-live-preview"];
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
                
                const errorMessage = err.message || String(err);

                // Handle specific session limit error
                if (errorMessage.includes("GoAway") || errorMessage.includes("session duration limit")) {
                  console.warn("Session limit reached. Disconnecting.");
                  session.close();
                  callbacks.onStateChange('disconnected', 'session_expired');
                  return;
                }

                // If we get an internal error or network error, it might be a transient issue
                if (errorMessage.includes("Internal error") || errorMessage.includes("Network error") || errorMessage.includes("Failed to fetch")) {
                  console.warn(`Transient error with ${model}.`);
                }

                // If this is the last model or a fatal error, notify the UI
                if (model === models[models.length - 1]) {
                  callbacks.onStateChange('disconnected', errorMessage);
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

  sendVideoFrame(base64Data: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({
          image: { data: base64Data, mimeType: 'image/jpeg' }
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
