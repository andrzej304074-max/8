import { NextResponse, type NextRequest } from "next/server";
import { config as appConfig } from "@/lib/config";
import { runTick } from "@/lib/tick";

/**
 * Dzienne domknięcie schedulera (Vercel Cron — patrz vercel.json). Tick jest
 * idempotentny i uruchamia się też przy każdym wejściu na Dashboard/Kolejkę,
 * więc cron to tylko siatka bezpieczeństwa na dni bez logowania.
 */
export async function GET(request: NextRequest) {
  if (appConfig.CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${appConfig.CRON_SECRET}`) {
      return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
    }
  }
  const result = await runTick();
  return NextResponse.json(result);
}
