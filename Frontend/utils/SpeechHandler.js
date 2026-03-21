import * as Speech from 'expo-speech';

class SpeechHandler {
  constructor() {
    this.isSpeaking = false;
    this.queue = [];
  }

  speak(text) {
    this.queue.push(text);
    if (!this.isSpeaking) {
      this._processQueue();
    }
  }

  _processQueue() {
    if (this.queue.length === 0) {
      this.isSpeaking = false;
      return;
    }
    this.isSpeaking = true;
    const text = this.queue.shift();
    // Re-triggering Speech while speaking can interrupt. Wait for `onDone` to speak next.
    Speech.speak(text, {
      rate: 0.85,
      onDone: () => this._processQueue(),
      onError: () => this._processQueue(),
      onStopped: () => this._processQueue(),
    });
  }
}

export default new SpeechHandler();
