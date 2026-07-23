import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-1 text-lg font-semibold">Menedżer Sprzedaży Vinted</h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Zaloguj się, aby przejść do magazynu.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
