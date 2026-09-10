import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex-1 flex flex-col justify-center px-6 pb-safe">
      <h1 className="text-3xl font-semibold tracking-tight">Treino</h1>
      <p className="mt-1 text-sm text-muted">Entre pra continuar.</p>
      <LoginForm />
    </main>
  );
}
