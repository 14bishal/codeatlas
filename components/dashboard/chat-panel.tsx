"use client";

import { Send, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export function ChatPanel() {
    const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([
        { role: 'ai', content: "Hello! I'm your AI architect. Select a file to explain or ask me anything about this repo." }
    ]);
    const [input, setInput] = useState("");

    const sendMessage = () => {
        if (!input.trim()) return;
        const newMessages = [...messages, { role: 'user' as const, content: input }];
        setMessages(newMessages);
        setInput("");

        // Simulate AI response
        setTimeout(() => {
            setMessages(prev => [...prev, { role: 'ai', content: "I'm analyzing the codebase... (This is a demo)" }]);
        }, 1000);
    };

    return (
        <div className="flex h-full flex-col border-l border-border bg-card">
            <div className="flex h-14 items-center border-b border-border px-4">
                <Bot className="mr-2 h-5 w-5 text-accent" />
                <h2 className="font-semibold text-foreground">AI Architect</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages?.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                            }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-t border-border p-4">
                <div className="flex gap-2">
                    <Input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                        placeholder="Ask about the code..."
                        className="bg-background"
                    />
                    <Button size="icon" onClick={sendMessage}>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
