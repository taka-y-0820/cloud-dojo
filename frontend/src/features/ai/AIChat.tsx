import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}
      
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-card border rounded-lg shadow-xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">AI Learning Assistant</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-accent rounded p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto p-4">
            <div className="text-sm text-muted-foreground">
              Ask me anything about what you're learning...
            </div>
          </div>
          
          <div className="p-4 border-t">
            <input
              type="text"
              placeholder="Type your question..."
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>
        </div>
      )}
    </>
  );
}
