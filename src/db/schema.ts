import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Wszystkie znaczniki czasu jako ISO 8601 (text) — czytelne w surowej bazie i sortowalne leksykalnie.
const nowIso = () => new Date().toISOString();

// Wszystkie kwoty w groszach (integer) — nigdy float, żeby marże liczyły się bez błędów zaokrągleń.

export const ITEM_STATUSES = [
  "draft",
  "ready",
  "listed",
  "reserved",
  "sold",
  "returned",
  "archived",
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const items = sqliteTable(
  "items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    brand: text("brand"),
    category: text("category"),
    size: text("size"),
    condition: text("condition"),
    color: text("color"),
    material: text("material"),
    purchasePriceGr: integer("purchase_price_gr"),
    expectedPriceGr: integer("expected_price_gr"),
    shippingCostGr: integer("shipping_cost_gr"),
    location: text("location"),
    status: text("status").$type<ItemStatus>().notNull().default("draft"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
  },
  (t) => [
    index("idx_items_status").on(t.status),
    index("idx_items_created_at").on(t.createdAt),
  ],
);

export const photos = sqliteTable(
  "photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    isMain: integer("is_main", { mode: "boolean" }).notNull().default(false),
    // Klucze w StorageProviderze (lokalny dysk lub Vercel Blob), nie surowe ścieżki systemowe.
    originalKey: text("original_key").notNull(),
    processedKey: text("processed_key"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [index("idx_photos_item_position").on(t.itemId, t.position)],
);

export const LISTING_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "ended",
  "sold",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const listings = sqliteTable(
  "listings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id),
    platform: text("platform").notNull().default("vinted"),
    externalId: text("external_id"),
    title: text("title").notNull(),
    description: text("description"),
    priceGr: integer("price_gr"),
    status: text("status").$type<ListingStatus>().notNull().default("draft"),
    publishedAt: text("published_at"),
    refreshedAt: text("refreshed_at"),
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    // Jawne rozróżnienie: co zrobiła aplikacja, a co użytkownik ręcznie.
    createdVia: text("created_via").$type<"manual" | "adapter">().notNull().default("manual"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
  },
  (t) => [
    index("idx_listings_item").on(t.itemId),
    index("idx_listings_account_status").on(t.accountId, t.status),
  ],
);

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  platform: text("platform").notNull().default("vinted"),
  sessionStatus: text("session_status")
    .$type<"manual" | "active" | "expired">()
    .notNull()
    .default("manual"),
  // Referencja do tabeli secrets — nigdy sam sekret.
  secretRef: text("secret_ref"),
  activeListingLimit: integer("active_listing_limit"),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
});

// Sesje kont wyłącznie jako szyfrogram AES-256-GCM; klucz szyfrujący żyje w zmiennej
// środowiskowej, więc zrzut bazy nie ujawnia sesji. Celowo bez klucza obcego do accounts —
// usunięcie sekretu (wylogowanie) nie może kaskadowo dotknąć danych konta.
export const secrets = sqliteTable("secrets", {
  ref: text("ref").primaryKey(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
  updatedAt: text("updated_at").notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
});

export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // Treść z placeholderami w rodzaju {marka}, {rozmiar}, {stan}, {wymiary}.
  body: text("body").notNull(),
  footer: text("footer"),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
  updatedAt: text("updated_at").notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
});

export const JOB_TYPES = ["publish", "relist", "price_drop", "refresh"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = [
  "pending",
  "due",
  "running",
  "done",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").$type<JobType>().notNull(),
    payload: text("payload"),
    // Ponowienie zadania po awarii nie może utworzyć duplikatu ogłoszenia.
    idempotencyKey: text("idempotency_key").notNull(),
    itemId: integer("item_id").references(() => items.id),
    accountId: integer("account_id").references(() => accounts.id),
    ruleId: integer("rule_id").references(() => rules.id),
    scheduledAt: text("scheduled_at").notNull(),
    status: text("status").$type<JobStatus>().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    result: text("result"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
  },
  (t) => [
    index("idx_jobs_status_scheduled").on(t.status, t.scheduledAt),
    uniqueIndex("idx_jobs_idempotency_key").on(t.idempotencyKey),
  ],
);

// Dziennik niezmienialny i celowo bez kluczy obcych — wpis ma przetrwać nawet
// usunięcie przedmiotu czy konta, których dotyczył.
export const eventLog = sqliteTable(
  "event_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    actor: text("actor").$type<"app" | "user">().notNull(),
    account: text("account"),
    action: text("action").notNull(),
    payload: text("payload"),
    outcome: text("outcome").$type<"ok" | "error">().notNull(),
    detail: text("detail"),
  },
  (t) => [
    index("idx_event_log_created").on(t.createdAt),
    index("idx_event_log_account_created").on(t.account, t.createdAt),
  ],
);

export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id),
    finalPriceGr: integer("final_price_gr").notNull(),
    commissionGr: integer("commission_gr").notNull().default(0),
    shippingGr: integer("shipping_gr").notNull().default(0),
    marginGr: integer("margin_gr"),
    soldAt: text("sold_at").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [index("idx_sales_sold_at").on(t.soldAt)],
);

// Silnik reguł relistingu: warunki i akcje to dane (JSON), nie kod.
export const rules = sqliteTable("rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  conditions: text("conditions").notNull(),
  actions: text("actions").notNull(),
  maxExecutions: integer("max_executions"),
  executionsCount: integer("executions_count").notNull().default(0),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
  updatedAt: text("updated_at").notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
});

// Cache odpowiedzi modelu wizyjnego po hashu zestawu zdjęć — nie płacimy dwa razy za to samo.
export const aiCache = sqliteTable("ai_cache", {
  photoSetHash: text("photo_set_hash").primaryKey(),
  response: text("response").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
});
