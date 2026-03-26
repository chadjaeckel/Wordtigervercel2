export class SpeechService {
  private static recognition: any = null;
  private static isListening = false;
  private static synthesis = window.speechSynthesis;

  static speak(text: string, force: boolean = false, rate: number = 1.0) {
    if (!this.synthesis) return;
    if (force) this.synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 0.85;
    utterance.rate = rate;
    utterance.volume = 1.0;
    this.synthesis.speak(utterance);
  }

  /** Cancel anything queued and speak immediately */
  static speakNow(text: string) {
    this.speak(text, true);
  }

  /**
   * Speak text at the given rate, then call onEnd when the utterance finishes.
   * Queues behind any currently-speaking utterance (does NOT cancel the queue).
   */
  static speakThen(text: string, rate: number = 1.0, onEnd?: () => void) {
    if (!this.synthesis) { onEnd?.(); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 0.85;
    utterance.rate = rate;
    utterance.volume = 1.0;
    if (onEnd) {
      utterance.onend = () => onEnd();
      utterance.onerror = () => onEnd(); // don't hang if speech fails
    }
    this.synthesis.speak(utterance);
  }

  static clearQueue() {
    if (this.synthesis) this.synthesis.cancel();
  }

  static isSpeaking() {
    return this.synthesis?.speaking ?? false;
  }

  static startListening(onResult: (text: string) => void, onError?: () => void) {
    if (this.isListening) return;

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.speak("Speech recognition is not supported in this browser. Please type your words instead.");
      if (onError) onError();
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    this.recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (onError) onError();
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };

    try {
      this.recognition.start();
      this.isListening = true;
    } catch (e) {
      console.error("Failed to start speech recognition", e);
      if (onError) onError();
    }
  }

  static stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  static getIsListening() {
    return this.isListening;
  }
}
