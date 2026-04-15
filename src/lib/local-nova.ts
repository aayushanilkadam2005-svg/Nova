export class LocalNova {
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoice();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoice();
    }
  }

  private loadVoice() {
    const voices = this.synth.getVoices();
    // Try to find a nice female voice
    this.voice = voices.find(v => v.name.includes('Female') || v.name.includes('Google UK English Female') || v.name.includes('Hindi')) || voices[0];
  }

  speak(text: string) {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
    const utter = new SpeechSynthesisUtterance(text);
    if (this.voice) utter.voice = this.voice;
    utter.pitch = 1.2; // Slightly higher for "Nova" feel
    utter.rate = 1.0;
    this.synth.speak(utter);
  }

  async getOfflineResponse(input: string): Promise<string> {
    const lower = input.toLowerCase();
    
    if (lower === 'start_session') {
      return "Hey Aayush what's up";
    }

    if (lower.includes('hi') || lower.includes('hello') || lower.includes('heyy')) {
      return "hello from nova bolo kaise yaad kiya mujhe (Offline Mode)";
    }
    
    if (lower.includes('time')) {
      return `The current time is ${new Date().toLocaleTimeString()}. I'm working offline right now!`;
    }
    
    if (lower.includes('who are you') || lower.includes('who created you')) {
      return "I am Nova, and Aayush created me! I'm currently in offline mode.";
    }

    if (lower.includes('battery')) {
      if ('getBattery' in navigator) {
        const battery: any = await (navigator as any).getBattery();
        return `Your device battery is at ${Math.round(battery.level * 100)}%.`;
      }
    }

    return "I'm currently offline, so I can only help with basic things like time, battery, or simple chats. Connect to the internet for my full brain!";
  }
}
