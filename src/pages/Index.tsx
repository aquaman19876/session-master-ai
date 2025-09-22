import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from '@supabase/supabase-js';
import AuthPage from "@/components/AuthPage";
import SessionDashboard from "@/components/SessionDashboard";
import ChatInterface from "@/components/ChatInterface";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || !session) {
    return <AuthPage />;
  }

  if (currentSessionId) {
    return (
      <ChatInterface
        sessionId={currentSessionId}
        onBack={() => setCurrentSessionId(null)}
      />
    );
  }

  return (
    <SessionDashboard
      onSessionSelect={(sessionId) => setCurrentSessionId(sessionId)}
      onSignOut={() => {
        setUser(null);
        setSession(null);
        setCurrentSessionId(null);
      }}
    />
  );
};

export default Index;
