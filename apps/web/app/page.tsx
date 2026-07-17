export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background text-foreground">
      <h1 className="text-3xl font-semibold tracking-tight mb-4">AI Crypto Agent</h1>
      <p className="text-zinc-500 dark:text-zinc-400 max-w-md text-center mb-8">
        The private operational console is operational. Access is restricted to trusted networks.
      </p>
      <form method="POST" action="/api/auth/logout">
        <button
          type="submit"
          className="px-4 py-2 text-sm border rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
