import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  accounts,
  aiCache,
  eventLog,
  items,
  jobs,
  listings,
  photos,
  ruleExecutions,
  rules,
  sales,
  secrets,
  templates,
} from "@/db/schema";

/**
 * Kopia zapasowa całej bazy jako jeden plik JSON. W chmurze (Turso) nie da się
 * po prostu skopiować pliku — ten eksport odtwarza spec "backup = jeden plik".
 * Uwaga: secrets zawiera wyłącznie szyfrogramy; klucz szyfrujący żyje w env,
 * więc backup bez env nie ujawnia sesji.
 */
export async function GET() {
  const [
    accountsData,
    itemsData,
    photosData,
    listingsData,
    templatesData,
    jobsData,
    eventLogData,
    salesData,
    rulesData,
    ruleExecutionsData,
    aiCacheData,
    secretsData,
  ] = await Promise.all([
    db.select().from(accounts),
    db.select().from(items),
    db.select().from(photos),
    db.select().from(listings),
    db.select().from(templates),
    db.select().from(jobs),
    db.select().from(eventLog),
    db.select().from(sales),
    db.select().from(rules),
    db.select().from(ruleExecutions),
    db.select().from(aiCache),
    db.select().from(secrets),
  ]);

  const backup = {
    format: "vinted-manager-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      accounts: accountsData,
      items: itemsData,
      photos: photosData,
      listings: listingsData,
      templates: templatesData,
      jobs: jobsData,
      event_log: eventLogData,
      sales: salesData,
      rules: rulesData,
      rule_executions: ruleExecutionsData,
      ai_cache: aiCacheData,
      secrets: secretsData,
    },
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
