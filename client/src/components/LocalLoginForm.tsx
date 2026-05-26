import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type LocalLoginFormProps = {
  compact?: boolean;
};

export function LocalLoginForm({ compact = false }: LocalLoginFormProps) {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      utils.auth.me.setData(undefined, data.user);
      await utils.auth.me.invalidate();
      toast.success("Signed in");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-2" : "space-y-3 w-full"}>
      <Input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        autoComplete="email"
        className={compact ? "h-8 text-xs bg-secondary border-border" : "bg-secondary border-border"}
      />
      <Input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        className={compact ? "h-8 text-xs bg-secondary border-border" : "bg-secondary border-border"}
      />
      <Button
        type="submit"
        disabled={login.isPending || !email || !password}
        size={compact ? "sm" : "lg"}
        className={compact ? "w-full text-xs" : "w-full shadow-lg hover:shadow-xl transition-all"}
        style={{
          background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))",
          color: "oklch(0.10 0.01 260)",
          fontWeight: 600,
        }}
      >
        {login.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <LogIn className="w-4 h-4" />
        )}
        Sign in
      </Button>
    </form>
  );
}
