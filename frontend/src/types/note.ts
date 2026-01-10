export interface Note {
  id: string;
  pageId: string;
  title: string;
  content: string;
  format: 'markdown' | 'html';
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface NotesStorage {
  save(pageId: string, note: Note): Promise<void>;
  load(pageId: string): Promise<Note | null>;
  delete(pageId: string): Promise<void>;
  list(): Promise<Note[]>;
}
