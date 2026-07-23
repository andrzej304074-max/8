export function ComingSoon({ title, etap }: { title: string; etap: string }) {
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">{title}</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Ten ekran powstanie w ramach: {etap}.
      </p>
    </div>
  );
}
