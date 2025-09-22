import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Send, Mic, Image, Camera, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Message {
  id: string;
  content: string;
  message_type: 'text' | 'image' | 'voice';
  ai_response: string;
  image_url?: string;
  created_at: string;
}

interface ChatInterfaceProps {
  sessionId: string;
  onBack: () => void;
}

const ChatInterface = ({ sessionId, onBack }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSession();
    fetchMessages();
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchSession = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('name, system_prompt')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      setSessionName(data.name);
      setSystemPrompt(data.system_prompt);
    } catch (error) {
      console.error('Error fetching session:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async (content: string, messageType: 'text' | 'image' | 'voice', imageData?: string) => {
    if ((!content.trim() && !imageData) || loading) return;

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Call Gemini API
      const { data: aiData, error: aiError } = await supabase.functions.invoke('gemini-chat', {
        body: {
          message: content,
          sessionId,
          messageType,
          imageData,
          systemPrompt
        }
      });

      if (aiError) throw aiError;

      // Store message in database
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([
          {
            session_id: sessionId,
            user_id: user.id,
            content: content || 'Image uploaded',
            message_type: messageType,
            ai_response: aiData.response
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Update session timestamp
      await supabase
        .from('sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      setCurrentMessage("");
      fetchMessages();

      toast({
        title: "Message sent",
        description: "AI response generated successfully",
      });

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            
            try {
              // Transcribe audio
              const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('transcribe-audio', {
                body: { audio: base64Audio }
              });

              if (transcribeError) throw transcribeError;

              // Send transcribed text as message
              await sendMessage(transcribeData.text, 'voice');
              
            } catch (error) {
              console.error('Error transcribing audio:', error);
              toast({
                title: "Error",
                description: "Failed to transcribe audio",
                variant: "destructive",
              });
            }
          };
          reader.readAsDataURL(audioBlob);
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);

        toast({
          title: "Recording started",
          description: "Speak now, tap again to stop",
        });

      } catch (error) {
        console.error('Error starting recording:', error);
        toast({
          title: "Error",
          description: "Microphone access denied",
          variant: "destructive",
        });
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Image = (e.target?.result as string).split(',')[1];
      await sendMessage('', 'image', base64Image);
    };
    reader.readAsDataURL(file);
  };

  const handlePasteImage = async (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const base64Image = (e.target?.result as string).split(',')[1];
            await sendMessage('', 'image', base64Image);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-foreground">{sessionName}</h1>
            <p className="text-sm text-muted-foreground">AI Study Assistant</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="space-y-2">
            {/* User message */}
            <div className="flex justify-end">
              <Card className="max-w-[80%] p-3 bg-gradient-to-r from-primary to-accent text-primary-foreground">
                <p className="text-sm">{message.content}</p>
                {message.message_type !== 'text' && (
                  <div className="text-xs mt-1 opacity-80">
                    {message.message_type === 'image' && '📷 Image'}
                    {message.message_type === 'voice' && '🎙️ Voice'}
                  </div>
                )}
              </Card>
            </div>

            {/* AI response */}
            <div className="flex justify-start">
              <Card className="max-w-[80%] p-3 bg-card">
                <p className="text-sm text-foreground whitespace-pre-wrap">{message.ai_response}</p>
              </Card>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-center">
            <Card className="p-4 bg-card">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">AI is thinking...</span>
              </div>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-card/50 backdrop-blur-sm p-4">
        <div className="flex gap-2">
          <Input
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            placeholder="Type your question or paste an image..."
            onKeyPress={(e) => e.key === 'Enter' && sendMessage(currentMessage, 'text')}
            onPaste={handlePasteImage}
            disabled={loading}
            className="flex-1"
          />
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleVoiceRecording}
            disabled={loading}
            className={isRecording ? "bg-destructive text-destructive-foreground" : ""}
          >
            <Mic className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            <Image className="h-4 w-4" />
          </Button>

          <Button
            onClick={() => sendMessage(currentMessage, 'text')}
            disabled={loading || !currentMessage.trim()}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />

        <p className="text-xs text-muted-foreground mt-2 text-center">
          Type, speak, or upload images for AI assistance
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;