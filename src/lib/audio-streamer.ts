
export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private playbackQueue: Int16Array[] = [];
  private isPlaying = false;
  private nextStartTime = 0;
  private onVolumeChange?: (volume: number) => void;

  constructor(private onAudioData: (base64Data: string) => void, onVolumeChange?: (volume: number) => void) {
    this.onVolumeChange = onVolumeChange;
  }

  async startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Your browser does not support audio recording.");
    }

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });

      // Browsers often start AudioContext in 'suspended' state
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.audioContext.createMediaStreamSource(this.stream);
    
    // Using ScriptProcessor for simplicity in this environment
    this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for activity indicator
      if (this.onVolumeChange) {
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.onVolumeChange(rms);
      }

      const pcm16Data = this.float32ToInt16(inputData);
      const base64Data = this.arrayBufferToBase64(pcm16Data.buffer);
      this.onAudioData(base64Data);
    };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (err) {
      console.error("Failed to start recording:", err);
      throw err;
    }
  }

  stopRecording() {
    this.source?.disconnect();
    this.processor?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
    this.audioContext = null;
  }

  handleAudioChunk(base64Data: string) {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pcm16Data = new Int16Array(bytes.buffer);
    this.playbackQueue.push(pcm16Data);
    this.playNextChunk();
  }

  private playNextChunk() {
    if (this.isPlaying || this.playbackQueue.length === 0) return;
    
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }

    this.isPlaying = true;
    const pcm16Data = this.playbackQueue.shift()!;
    const float32Data = this.int16ToFloat32(pcm16Data);
    
    const buffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    
    const startTime = Math.max(this.audioContext.currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;
    
    source.onended = () => {
      this.isPlaying = false;
      this.playNextChunk();
    };
  }

  clearQueue() {
    this.playbackQueue = [];
    this.nextStartTime = 0;
  }

  private float32ToInt16(buffer: Float32Array): Int16Array {
    const l = buffer.length;
    const buf = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      buf[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return buf;
  }

  private int16ToFloat32(buffer: Int16Array): Float32Array {
    const l = buffer.length;
    const buf = new Float32Array(l);
    for (let i = 0; i < l; i++) {
      buf[i] = buffer[i] / 0x8000;
    }
    return buf;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
