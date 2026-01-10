import { Note, NotesStorage } from '../types/note';

// LocalStorageを使った実装（後でPostgreSQLに切り替え可能）
class LocalStorageNotesService implements NotesStorage {
  private readonly storagePrefix = 'cloud-dojo-notes';

  async save(pageId: string, note: Note): Promise<void> {
    const key = `${this.storagePrefix}-${pageId}`;
    localStorage.setItem(key, JSON.stringify(note));
  }

  async load(pageId: string): Promise<Note | null> {
    const key = `${this.storagePrefix}-${pageId}`;
    const data = localStorage.getItem(key);
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse note:', error);
      return null;
    }
  }

  async delete(pageId: string): Promise<void> {
    const key = `${this.storagePrefix}-${pageId}`;
    localStorage.removeItem(key);
  }

  async list(): Promise<Note[]> {
    const notes: Note[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.storagePrefix)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            notes.push(JSON.parse(data));
          } catch (error) {
            console.error('Failed to parse note:', error);
          }
        }
      }
    }
    return notes;
  }
}

// PostgreSQL実装の準備（将来の実装用）
class ApiNotesService implements NotesStorage {
  private readonly apiUrl = '/api/notes';

  async save(pageId: string, note: Note): Promise<void> {
    await fetch(`${this.apiUrl}/${pageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
  }

  async load(pageId: string): Promise<Note | null> {
    const response = await fetch(`${this.apiUrl}/${pageId}`);
    if (!response.ok) return null;
    return response.json();
  }

  async delete(pageId: string): Promise<void> {
    await fetch(`${this.apiUrl}/${pageId}`, { method: 'DELETE' });
  }

  async list(): Promise<Note[]> {
    const response = await fetch(this.apiUrl);
    return response.json();
  }
}

// 環境変数で切り替え可能
const USE_API = import.meta.env.VITE_USE_API_NOTES === 'true';
export const notesService: NotesStorage = USE_API
  ? new ApiNotesService()
  : new LocalStorageNotesService();
