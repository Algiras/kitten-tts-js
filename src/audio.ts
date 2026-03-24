/**
 * RawAudio: wraps a Float32Array waveform with sampling_rate metadata.
 * Provides WAV export for both Node.js and browser.
 */

export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numSamples = samples.length;
  const bitsPerSample = 16;
  const numChannels = 1;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

export class RawAudio {
  readonly data: Float32Array;
  readonly sampling_rate: number;

  constructor(data: Float32Array, sampling_rate: number) {
    this.data = data;
    this.sampling_rate = sampling_rate;
  }

  toWav(): ArrayBuffer {
    return encodeWav(this.data, this.sampling_rate);
  }

  async save(filePath: string): Promise<void> {
    const { default: fs } = await import('fs');
    const wav = this.toWav();
    fs.writeFileSync(filePath, Buffer.from(wav));
    console.log(`[kitten-tts] Saved WAV: ${filePath} (${this.data.length} samples @ ${this.sampling_rate} Hz)`);
  }

  toBlob(): Blob {
    return new Blob([this.toWav()], { type: 'audio/wav' });
  }

  toAudioBuffer(audioContext: AudioContext): AudioBuffer {
    const audioBuf = audioContext.createBuffer(1, this.data.length, this.sampling_rate);
    audioBuf.copyToChannel(new Float32Array(this.data), 0);
    return audioBuf;
  }

  get duration(): number {
    return this.data.length / this.sampling_rate;
  }
}
