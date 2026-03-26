export const COMMON_PROPER_NOUNS = new Set([
  "john", "mary", "james", "robert", "smith",
  "jones", "michael", "linda", "david", "jennifer",
  "william", "elizabeth", "thomas", "sarah"
]);

class DictionaryService {
  public words: Set<string> = new Set();
  public isLoaded: boolean = false;

  async load(): Promise<void> {
    if (this.isLoaded) return;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}words.txt`);
      if (!response.ok) throw new Error("Failed to load dictionary");
      
      const text = await response.text();
      const wordList = text.split(/\r?\n/);
      
      this.words = new Set();
      for (let w of wordList) {
        w = w.trim().toLowerCase();
        if (w.length >= 4 && !COMMON_PROPER_NOUNS.has(w)) {
          this.words.add(w);
        }
      }
      this.isLoaded = true;
    } catch (error) {
      console.error("Dictionary load error:", error);
      // Fallback for demo/development if words.txt is missing
      const fallbackWords = [
        "tiger", "tigers", "great", "greet", "greeting", 
        "target", "targets", "about", "after", "again",
        "below", "could", "every", "first", "found", "right",
        "small", "sound", "spell", "still", "study", "their",
        "there", "these", "thing", "think", "three", "water"
      ];
      this.words = new Set(fallbackWords);
      this.isLoaded = true;
    }
  }

  isValidWord(word: string): boolean {
    return this.words.has(word.toLowerCase());
  }
}

export const Dictionary = new DictionaryService();
