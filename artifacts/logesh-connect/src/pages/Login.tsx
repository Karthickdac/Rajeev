import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertCircle, Lock } from "lucide-react";
import { useLogin } from "@workspace/api-client-react";
import { setToken } from "@/lib/auth";
import { useLeaderConfig } from "@/lib/LeaderConfigContext";

/** Decode the role claim from a JWT payload without verifying the signature. */
function roleFromToken(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

const schema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormData = z.infer<typeof schema>;

export default function Login() {
  const leader = useLeaderConfig();
  const [, setLocation] = useLocation();
  const [error, setError] = useState("");
  const mutation = useLogin();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: FormData) {
    setError("");
    mutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          setToken(data.token);
          const role = roleFromToken(data.token);
          const home = role === "minister" ? "minister-home" : role === "pa_staff" ? "pa-home" : "";
          if (home) window.location.hash = home;
          setLocation("/admin");
        },
        onError: () => setError("Invalid credentials. Please try again."),
      }
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center tvk-hero-gradient px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
            {leader.logoInitial}
          </div>
          <h1 className="text-xl font-bold text-white">{leader.siteTitle}</h1>
          <p className="text-white/70 text-sm mt-1">Admin Portal</p>
        </div>

        <Card className="shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-center flex items-center justify-center gap-2 text-lg">
              <Lock className="w-5 h-5 text-primary" />
              Admin Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm mb-4">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input data-testid="login-email" type="email" placeholder="admin@logeshconnect.in" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input data-testid="login-password" type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button
                  data-testid="login-submit"
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Role hints */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-white/80">
            <p className="text-[11px] font-semibold">Staff / PA / Minister</p>
            <p className="text-[10px] text-white/60 mt-0.5">Sign in above to reach your portal.</p>
          </div>
          <a
            href="/grievance"
            className="rounded-lg bg-primary/90 hover:bg-primary border border-white/15 px-3 py-2.5 text-white transition-colors flex flex-col justify-center"
          >
            <p className="text-[11px] font-semibold">Public visitor?</p>
            <p className="text-[10px] text-white/80 mt-0.5">Submit a Grievance →</p>
          </a>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          Authorized personnel only
        </p>
      </div>
    </div>
  );
}
