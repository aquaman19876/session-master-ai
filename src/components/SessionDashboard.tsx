import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Plus, BookOpen, LogOut, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Session {
  id: string;
  name: string;
  system_prompt: string;
  created_at: string;
  updated_at: string;
}

interface SessionDashboardProps {
  onSessionSelect: (sessionId: string) => void;
  onSignOut: () => void;
}

const SessionDashboard = ({ onSessionSelect, onSignOut }: SessionDashboardProps) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionName, setSessionName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful study assistant. Analyze the content provided and give clear, educational explanations.");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load sessions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    if (!sessionName.trim()) {
      toast({
        title: "Session name required",
        description: "Please enter a name for your study session",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sessions')
        .insert([
          {
            name: sessionName,
            system_prompt: systemPrompt,
            user_id: user.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Session created",
        description: `${sessionName} is ready for studying`,
      });

      setSessionName("");
      setSystemPrompt("You are a helpful study assistant. Analyze the content provided and give clear, educational explanations.");
      setCreateDialogOpen(false);
      fetchSessions();
    } catch (error) {
      console.error('Error creating session:', error);
      toast({
        title: "Error",
        description: "Failed to create session",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      onSignOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your study sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">StudyMaster AI</h1>
            <p className="text-muted-foreground">Your intelligent study sessions</p>
          </div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Card className="border-dashed border-2 hover:border-primary/50 cursor-pointer transition-all hover:shadow-elegant group">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center mb-4 group-hover:shadow-glow transition-all">
                    <Plus className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Create New Session</h3>
                  <p className="text-sm text-muted-foreground">Start a new study session with AI assistance</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Study Session</DialogTitle>
                <DialogDescription>
                  Set up a new AI-powered study session with custom instructions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Session Name</label>
                  <Input
                    placeholder="e.g., Mathematics Exam Prep"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">AI Instructions</label>
                  <Textarea
                    placeholder="Customize how the AI should help you study..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button
                  onClick={createSession}
                  disabled={creating}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground"
                >
                  {creating ? "Creating..." : "Create Session"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-elegant transition-all cursor-pointer group" onClick={() => onSessionSelect(session.id)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-primary to-accent flex items-center justify-center group-hover:shadow-glow transition-all">
                    <BookOpen className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(session.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <CardTitle className="text-lg">{session.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {session.system_prompt}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {sessions.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No study sessions yet</h3>
            <p className="text-muted-foreground mb-4">Create your first session to start studying with AI assistance</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionDashboard;