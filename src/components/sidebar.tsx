"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/magazyn", label: "Magazyn" },
  { href: "/dodaj", label: "Dodaj przedmiot" },
  { href: "/kolejka", label: "Kolejka" },
  { href: "/reguly", label: "Reguły" },
  { href: "/statystyki", label: "Statystyki" },
  { href: "/konta", label: "Konta" },
  { href: "/historia", label: "Historia" },
  { href: "/ustawienia", label: "Ustawienia" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="text-sm font-semibold">Menedżer Sprzedaży</span>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {LINKS.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded px-3 py-1.5 text-sm ${
                active
                  ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <form action={logout} className="border-t border-zinc-200 p-2 dark:border-zinc-800">
        <button
          type="submit"
          className="w-full rounded px-3 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Wyloguj
        </button>
      </form>
    </aside>
  );
}
