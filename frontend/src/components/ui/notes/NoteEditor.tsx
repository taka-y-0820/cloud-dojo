import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save,
  Download,
  Upload,
  Trash2,
  Eye,
  Code,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Link,
  Image,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  CheckSquare,
  AlertCircle,
} from 'lucide-react';
import { notesService } from '@/services/noteService';
import { Note } from '@/types/note';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface NoteEditorProps {
  pageId: string;
  pageTitle: string;
}

interface CodeProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function NoteEditor({ pageId, pageTitle }: NoteEditorProps) {
  const [note, setNote] = useState<Note>({
    id: crypto.randomUUID(),
    pageId,
    title: `${pageTitle}のメモ`,
    content: '',
    format: 'markdown',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSave, setAutoSave] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 800; // 必要に応じて調整
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  // ロード
  useEffect(() => {
    const loadNote = async () => {
      const saved = await notesService.load(pageId);
      if (saved) {
        setNote(saved);
        setLastSaved(new Date(saved.updatedAt));
        setTimeout(() => adjustTextareaHeight(), 0);
      }
    };
    loadNote();
  }, [pageId]);

  // 自動保存
  useEffect(() => {
    if (!autoSave || !isDirty) return;

    const timer = setTimeout(() => {
      saveNote({ viaAuto: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [note.content, autoSave, isDirty]);

  const saveNote = useCallback(
    async (opts?: { viaAuto?: boolean }) => {
      // 自動保存からの呼び出しで内容が空文字のみなら保存しない
      if (opts?.viaAuto && note.content.trim() === '') {
        return;
      }

      const updatedNote = {
        ...note,
        updatedAt: new Date().toISOString(),
      };
      await notesService.save(pageId, updatedNote);
      setNote(updatedNote);
      setLastSaved(new Date());
      setIsDirty(false);
    },
    [note, pageId]
  );

  const handleContentChange = (content: string) => {
    setNote((prev) => ({ ...prev, content }));
    setIsDirty(true);
  };

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = document.querySelector('textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = note.content.substring(start, end);
    const newText =
      note.content.substring(0, start) +
      before +
      selectedText +
      after +
      note.content.substring(end);

    handleContentChange(newText);

    // カーソル位置を調整
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length
      );
    }, 0);
  };

  const exportNote = () => {
    const blob = new Blob([note.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pageTitle}-notes-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importNote = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      handleContentChange(content);
    };
    reader.readAsText(file);
  };

  const clearNote = async () => {
    if (isDirty) return;

    if (confirm('すべてのメモを削除しますか？この操作は取り消せません。')) {
      await notesService.delete(pageId);
      setNote({
        id: crypto.randomUUID(),
        pageId,
        title: `${pageTitle}のメモ`,
        content: '',
        format: 'markdown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setLastSaved(null);
      setIsDirty(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* ヘッダー */}
      <div className="border-b p-4 bg-gradient-to-r from-amber-500/5 to-yellow-500/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* テキストスタイル */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => insertMarkdown('**', '**')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="太字"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertMarkdown('*', '*')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="斜体"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertMarkdown('~~', '~~')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="取り消し線"
              >
                <Strikethrough className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertMarkdown('`', '`')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="コード"
              >
                <Code className="w-4 h-4" />
              </button>
            </div>

            {/* 見出し */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => insertMarkdown('# ', '')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="見出し1"
              >
                <Heading1 className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertMarkdown('## ', '')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="見出し2"
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertMarkdown('### ', '')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="見出し3"
              >
                <Heading3 className="w-4 h-4" />
              </button>
            </div>

            {/* リスト */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => insertMarkdown('- ', '')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="箇条書き"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertMarkdown('1. ', '')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="番号付きリスト"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertMarkdown('- [ ] ', '')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="チェックリスト"
              >
                <CheckSquare className="w-4 h-4" />
              </button>
            </div>

            {/* その他 */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => insertMarkdown('[', '](url)')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="リンク"
              >
                <Link className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertMarkdown('![alt](', ')')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="画像"
              >
                <Image className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertMarkdown('> ', '')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="引用"
              >
                <Quote className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertMarkdown('```\n', '\n```')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="コードブロック"
              >
                <Code className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertMarkdown('---\n', '')}
                className="p-1.5 hover:bg-muted-foreground/10 rounded transition-colors"
                title="区切り線"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1" />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="rounded"
              />
              自動保存
            </label>
          </div>
        </div>

        {/* ツールバー */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => saveNote()}
                disabled={autoSave || !isDirty}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                保存
              </button>

              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  previewMode
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
                }`}
              >
                <Eye className="w-4 h-4" />
                {previewMode ? 'エディタ' : 'プレビュー'}
              </button>
              <button
                onClick={exportNote}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                エクスポート
              </button>
              <label className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 text-purple-500 rounded-lg hover:bg-purple-500/20 transition-colors text-sm cursor-pointer">
                <Upload className="w-4 h-4" />
                インポート
                <input type="file" accept=".md,.txt" onChange={importNote} className="hidden" />
              </label>
              <button
                onClick={clearNote}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                クリア
              </button>
            </div>
            {lastSaved && (
              <div className="text-xs text-muted-foreground">
                最終保存: {lastSaved.toLocaleString('ja-JP')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* エディター/プレビュー */}
      <div className="flex-1 overflow-hidden">
        {previewMode ? (
          <div className="h-full overflow-auto p-6 prose prose-slate dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => (
                  <h1 className="text-4xl font-bold mb-4 mt-8" {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="text-3xl font-bold mb-3 mt-6" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="text-2xl font-bold mb-2 mt-4" {...props} />
                ),
                h4: ({ node, ...props }) => (
                  <h4 className="text-xl font-bold mb-2 mt-3" {...props} />
                ),
                h5: ({ node, ...props }) => (
                  <h5 className="text-lg font-bold mb-1 mt-2" {...props} />
                ),
                h6: ({ node, ...props }) => (
                  <h6 className="text-base font-bold mb-1 mt-2" {...props} />
                ),
                p: ({ node, ...props }) => <p className="mb-4" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc ml-6 mb-4" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal ml-6 mb-4" {...props} />,
                li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4" {...props} />
                ),
                code({ node, inline, className, children, ...props }: CodeProps) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code
                      className="bg-gray-800 text-green-400 px-1.5 py-0.5 rounded text-sm font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {note.content || '*プレビューする内容がありません*'}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={note.content}
            onChange={(e) => handleContentChange(e.target.value)}
            onInput={adjustTextareaHeight}
            placeholder={`# ${pageTitle}の学習メモ

## 学んだこと
- 

## 重要なコマンド
\`\`\`bash
command here
\`\`\`

## メモ
`}
            style={{ height: 'auto' }}
            className="w-full h-full resize-none p-6 bg-background border-0 focus:outline-none font-mono text-sm"
          />
        )}
      </div>

      {/* フッター */}
      <div className="border-t px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span>{note.content.length.toLocaleString()} 文字</span>
          <span>{note.content.split('\n').length} 行</span>
          <span>{note.content.split(/\s+/).filter(Boolean).length} 単語</span>
        </div>
        <div className="flex items-center gap-2">
          {isDirty ? (
            <span className="flex items-center gap-1 text-xs text-orange-500 ml-3">
              <AlertCircle className="w-3 h-3" />
              未保存
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-green-600 ml-3">
              <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              保存済み
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
