import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Send, Loader2, Bot, User } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AiChatProps {
  onError?: (error: string) => void;
}

export function AiChat({ onError }: AiChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Create a session when component mounts
    createSession();
    
    return () => {
      // Cleanup event source on unmount
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const createSession = async () => {
    try {
      const response = await fetch("/api/opencode/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `AI Chat - ${new Date().toLocaleString()}`,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedError = errorText;
        try {
          const errorObj = JSON.parse(errorText);
          parsedError = errorObj.error || errorText;
        } catch {}
        throw new Error(`Failed to create session (${response.status}): ${parsedError}`);
      }

      const session = await response.json();
      setSessionId(session.id);
      
      // Set up server-sent events for this session
      setupEventSource(session.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to create session";
      onError?.(errorMsg);
      console.error("Failed to create session:", error);
      
      // Still show an error in the chat that suggests what to do
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "❌ Unable to connect to OpenCode server. Please ensure:\n\n1. OpenCode server is running on port 3001\n2. You have proper authentication set up\n3. Try refreshing the page",
        timestamp: new Date(),
      }]);
    }
  };

  const fetchLatestMessages = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/opencode/session/${sessionId}/message`);
      if (response.ok) {
        const messagesData = await response.json();
        console.log("📨 Latest messages:", messagesData);
        
        // Process the messages and add any new assistant messages
        if (Array.isArray(messagesData)) {
          messagesData.forEach((msgData: any) => {
            if (msgData.info?.role === "assistant") {
              const content = msgData.parts?.map((p: any) => p.text || p.content).filter(Boolean).join("") || "Response received";
              console.log("📨 Assistant message content:", content);
              
              setMessages(prev => {
                // Check if this message already exists
                const existingIndex = prev.findIndex(m => m.id === msgData.info.id);
                if (existingIndex >= 0) {
                  // Update existing message with full content
                  const updated = [...prev];
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    content: content || updated[existingIndex].content,
                  };
                  return updated;
                }
                // Add new message
                return [...prev, {
                  id: msgData.info.id,
                  role: "assistant",
                  content: content,
                  timestamp: new Date(msgData.info.time?.created || Date.now()),
                }];
              });
              setIsLoading(false);
            }
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch latest messages:", error);
    }
  };

  const setupEventSource = (sessionId: string) => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Set up server-sent events to listen for responses
    const eventSource = new EventSource(`/api/opencode/events`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("🌊 SSE Event received:", data);
        
        // Handle different event types - be more flexible with event matching
        if (data.properties?.sessionID === sessionId || data.properties?.info?.id?.startsWith(sessionId) || data.properties?.messageID?.includes(sessionId.slice(4, 12))) {
          console.log("🎯 Event matched session:", sessionId);
          
          // Handle streaming message parts
          if (data.type === "message.part.updated") {
            const partData = data.properties;
            console.log("📝 Part updated:", partData);
            
            setMessages(prev => {
              const existingIndex = prev.findIndex(m => m.id === partData.messageID);
              if (existingIndex >= 0) {
                // Update existing message with new content
                const updatedMessages = [...prev];
                const currentContent = updatedMessages[existingIndex].content;
                const newContent = partData.text || partData.content || "";
                
                // Append new content if it's different
                if (!currentContent.includes(newContent)) {
                  updatedMessages[existingIndex] = {
                    ...updatedMessages[existingIndex],
                    content: currentContent + newContent,
                  };
                }
                return updatedMessages;
              } else if (partData.messageID) {
                // Create new assistant message
                return [...prev, {
                  id: partData.messageID,
                  role: "assistant",
                  content: partData.text || partData.content || "",
                  timestamp: new Date(),
                }];
              }
              return prev;
            });
            setIsLoading(false);
          }
          // Look for complete message events
          else if (data.type === "message.created" || data.type === "message.updated") {
            console.log("📨 Message updated:", data.properties);
            const messageData = data.properties;
            if (messageData.role === "assistant") {
              setMessages(prev => {
                // Check if message already exists
                const existingIndex = prev.findIndex(m => m.id === messageData.id);
                if (existingIndex >= 0) {
                  return prev; // Already exists, don't duplicate
                }
                return [...prev, {
                  id: messageData.id,
                  role: "assistant",
                  content: messageData.content || "Response received",
                  timestamp: new Date(messageData.timestamp || Date.now()),
                }];
              });
              setIsLoading(false);
            }
          }
          // Handle session idle - message is complete
          else if (data.type === "session.idle") {
            console.log("✅ Session idle - message complete");
            setIsLoading(false);
            // Fetch latest messages to ensure we have complete content
            setTimeout(() => fetchLatestMessages(sessionId), 500);
          }
          // Also handle session.updated events that might contain message info
          else if (data.type === "session.updated") {
            console.log("📝 Session updated, checking for new messages...");
            // The session was updated, possibly with a new message
            // We should fetch the latest messages for this session
            fetchLatestMessages(sessionId);
          }
        }
      } catch (error) {
        console.error("Error parsing SSE event:", error, event.data);
      }
    };

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error);
      // Don't constantly reconnect - the chat can work without SSE using fallback polling
      // Instead of aggressive reconnection, just log the error and rely on fallback
      console.log("🔄 SSE connection lost, relying on polling fallback");
    };
  };

  const sendMessage = async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`/api/opencode/session/${sessionId}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: {
            providerID: "anthropic",
            modelID: "claude-3-5-sonnet-20241022", // Claude Sonnet 3.5 (latest available)
          },
          parts: [
            {
              type: "text",
              text: input.trim(),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }

      // The response will come through SSE, but also poll as fallback after a delay
      setTimeout(() => {
        if (sessionId) {
          fetchLatestMessages(sessionId);
        }
      }, 2000); // Poll after 2 seconds as fallback
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to send message";
      onError?.(errorMsg);
      console.error("Failed to send message:", error);
      setIsLoading(false);
      
      // Add error message to chat
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: `Error: ${errorMsg}`,
        timestamp: new Date(),
      }]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
    setIsLoading(false);
  };

  return (
    <Card className="h-96 flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Chat
          </CardTitle>
          <div className="flex gap-2">
            <Button
              onClick={clearChat}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              Clear
            </Button>
            {!sessionId && (
              <Button
                onClick={createSession}
                variant="outline"
                size="sm"
              >
                Reconnect
              </Button>
            )}
          </div>
        </div>
        {sessionId && (
          <div className="text-xs text-gray-500">
            Session: {sessionId.substring(0, 8)}...
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex flex-col flex-1 min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Start a conversation with Claude AI</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {message.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                    <span className="text-xs opacity-75">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Claude is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading || !sessionId}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || !sessionId}
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {!sessionId && (
          <div className="text-xs text-red-500 mt-2">
            No session connected. Click Reconnect to try again.
          </div>
        )}
      </CardContent>
    </Card>
  );
}