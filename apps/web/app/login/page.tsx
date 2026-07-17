export default function LoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  const hasError = searchParams?.error === "1";

  return (
    <main className="flex min-h-screen items-center justify-center p-8 bg-background text-foreground">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-center">AI Crypto Agent</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
          Private operational console
        </p>

        {hasError && (
          <p className="text-sm text-red-600 text-center" role="alert">
            Invalid credentials. Please try again.
          </p>
        )}

        <form method="POST" action="/api/auth/login" className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              autoComplete="username"
              required
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              autoComplete="current-password"
              required
              className="w-full px-3 py-2 border rounded-md bg-background"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
