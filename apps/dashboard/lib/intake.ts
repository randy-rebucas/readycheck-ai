/**
 * The new-project intake: a question bank whose questions switch on and off
 * with earlier answers, and the Blueprint derived from those answers. Pure
 * functions only, so the wizard (client) and project pages (server) agree.
 */

export type Answer = string | string[];
export type Answers = Record<string, Answer>;

/** Stored when someone picks "Not sure, decide for me". */
export const DECIDE = "decide";

export const SECTIONS = [
  { id: "identity", label: "Identity" },
  { id: "scope", label: "Scope" },
  { id: "data", label: "Data and privacy" },
  { id: "design", label: "Design" },
  { id: "technical", label: "Technical" },
  { id: "operations", label: "Operations" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export interface Option {
  id: string;
  label: string;
  hint?: string;
}

export interface Question {
  id: string;
  section: SectionId;
  kind: "single" | "multi" | "text";
  title: string;
  help: string;
  options?: Option[] | ((a: Answers) => Option[]);
  placeholder?: string;
  /** Offer "Not sure, decide for me"; the value is the option we pick and why. */
  decide?: { pick: string; because: string };
  /** Shown under "Why we ask". */
  why?: string | ((a: Answers) => string);
  /** Asked only when this returns true. */
  when?: (a: Answers) => boolean;
  /** Listed in the sections rail when the question is switched off. */
  skippedNote?: string;
  /** Rendered as a follow-up card under this question instead of on its own. */
  followUpOf?: string;
  /** Earlier answer the follow-up is based on, quoted under it. */
  basedOn?: string;
}

const str = (a: Answers, id: string): string => (typeof a[id] === "string" ? (a[id] as string) : "");
const list = (a: Answers, id: string): string[] => (Array.isArray(a[id]) ? (a[id] as string[]) : []);
const has = (a: Answers, id: string, value: string) => list(a, id).includes(value);

const isMobile = (a: Answers) => str(a, "kind") === "mobile";
const isWebsite = (a: Answers) => str(a, "kind") === "website";
const takesPayments = (a: Answers) => has(a, "features", "payments") || str(a, "kind") === "store";
const storesPeople = (a: Answers) => resolved(a, "personal") !== "none";

const FEATURES: Option[] = [
  { id: "accounts", label: "Accounts and login" },
  { id: "bookings", label: "Scheduling or bookings" },
  { id: "payments", label: "Payments" },
  { id: "uploads", label: "Photos or file uploads" },
  { id: "messaging", label: "Messages or notifications" },
  { id: "location", label: "Maps or location" },
  { id: "search", label: "Search" },
  { id: "reports", label: "Reports and dashboards" },
];

const REGIONS: Record<string, string> = {
  ph: "the Philippines",
  us: "the United States",
  eu: "the EU or UK",
  world: "many countries",
  other: "one other country",
};

export const QUESTIONS: Question[] = [
  // ---------- Identity ----------
  {
    id: "pitch",
    section: "identity",
    kind: "text",
    title: "In one sentence, what does the app do?",
    help: "Write it the way you'd explain it to a customer.",
    placeholder: "Technicians see their jobs for the day and get customers to sign off",
    why: "We use this to name things, pick sensible defaults and catch features you didn't list.",
  },
  {
    id: "kind",
    section: "identity",
    kind: "single",
    title: "What are you building?",
    help: "Pick the closest one. You can be more specific later.",
    options: [
      { id: "website", label: "Website", hint: "Mostly pages to read, a contact form at most" },
      { id: "webapp", label: "Web app", hint: "People sign in and get work done in a browser" },
      { id: "mobile", label: "Mobile app", hint: "Installed on phones from the app stores" },
      { id: "store", label: "Online store", hint: "Products, a cart and checkout" },
      { id: "saas", label: "SaaS product", hint: "Businesses sign up and pay a subscription" },
      { id: "internal", label: "Internal tool", hint: "Only your own staff use it" },
    ],
    why: "The kind of app decides the stack, the hosting and which standards we check it against.",
  },
  {
    id: "platforms",
    section: "identity",
    kind: "single",
    title: "Which phones does it need to run on?",
    help: "Building for both costs little extra with the stack we'd use.",
    options: [
      { id: "both", label: "iOS and Android" },
      { id: "ios", label: "iPhone only" },
      { id: "android", label: "Android only" },
    ],
    decide: { pick: "both", because: "One codebase covers both, so you don't lose half your users." },
    when: isMobile,
    skippedNote: "Phone platforms: not a mobile app",
  },
  {
    id: "region",
    section: "identity",
    kind: "single",
    title: "Where are most of your users?",
    help: "Privacy and consumer laws follow your users, not where you're based.",
    options: [
      { id: "ph", label: "Philippines" },
      { id: "us", label: "United States" },
      { id: "eu", label: "EU or UK" },
      { id: "world", label: "Worldwide" },
      { id: "other", label: "Somewhere else" },
    ],
    why: "This decides which privacy law applies, such as GDPR, CCPA or the PH Data Privacy Act.",
  },
  {
    id: "audience",
    section: "identity",
    kind: "single",
    title: "Who will use it?",
    help: "If it's a mix, pick who matters most for the first release.",
    options: [
      { id: "public", label: "The public", hint: "Anyone can sign up" },
      { id: "business", label: "Business customers", hint: "Companies you sell to" },
      { id: "staff", label: "Your own staff", hint: "People you can train" },
    ],
  },

  // ---------- Scope ----------
  {
    id: "roles",
    section: "scope",
    kind: "single",
    title: "How many kinds of users are there?",
    help: "A role is a group that sees different screens, like customers and admins.",
    options: [
      { id: "1", label: "One", hint: "Everyone sees the same thing" },
      { id: "2", label: "Two", hint: "For example customers and admins" },
      { id: "3", label: "Three or more", hint: "For example customers, staff and managers" },
    ],
    when: (a) => !isWebsite(a),
    skippedNote: "User roles: websites have no sign-in",
  },
  {
    id: "day",
    section: "scope",
    kind: "text",
    title: "What does a typical user do on a normal day?",
    help: "A few sentences is plenty. Mention anything they photograph, pay for or sign.",
    placeholder: "Techs check their schedule, drive to each customer and take before and after photos",
    why: "Plain descriptions surface needs that checklists miss. We ask follow-ups based on it.",
  },
  {
    id: "features",
    section: "scope",
    kind: "multi",
    title: "Which of these does it need?",
    help: "Pick everything that applies, now or later. The next question splits them into releases.",
    options: (a) => (str(a, "kind") === "store" ? FEATURES.filter((f) => f.id !== "payments") : FEATURES),
  },
  {
    id: "mvp",
    section: "scope",
    kind: "multi",
    title: "Which must be in the first release?",
    help: "Everything else goes in a later release. Fewer means you launch sooner.",
    options: (a) => FEATURES.filter((f) => has(a, "features", f.id)),
    when: (a) => list(a, "features").length > 1,
    skippedNote: "Release split: fewer than two features",
  },
  {
    id: "scale",
    section: "scope",
    kind: "single",
    title: "How many people will use it in the first year?",
    help: "A rough guess is fine. It sizes hosting, not the code.",
    options: [
      { id: "s", label: "Under 100" },
      { id: "m", label: "100 to 10,000" },
      { id: "l", label: "10,000 to 100,000" },
      { id: "xl", label: "More than 100,000" },
    ],
    decide: { pick: "m", because: "Sized for steady growth; hosting scales up when you need it." },
  },
  {
    id: "deadline",
    section: "scope",
    kind: "single",
    title: "When do you need the first release?",
    help: "We use this to decide what moves to a later release.",
    options: [
      { id: "1m", label: "Within a month" },
      { id: "3m", label: "In about three months" },
      { id: "6m", label: "In six months or more" },
      { id: "none", label: "No deadline" },
    ],
  },

  // ---------- Data and privacy ----------
  {
    id: "personal",
    section: "data",
    kind: "single",
    title: "What information about people will the app store?",
    help: "This decides which privacy rules apply and how the database is protected. Pick the closest one.",
    options: [
      { id: "sensitive", label: "Sensitive details", hint: "Health, financial, government IDs, exact location" },
      { id: "contact", label: "Contact details only", hint: "Names, emails, phone numbers, addresses" },
      { id: "none", label: "No personal data", hint: "Anonymous use, no accounts" },
    ],
    decide: {
      pick: "sensitive",
      because: "We treat the data as sensitive, so it's protected either way. You can relax it later.",
    },
    why: (a) => {
      const law = privacyLaw(a);
      const where = REGIONS[str(a, "region")];
      const lead = law && where ? `Your users are in ${where}, so ${law.long} applies to any personal data. ` : "";
      switch (resolved(a, "personal")) {
        case "sensitive":
          return `${lead}Sensitive data switches on field-level encryption, audit logs, a privacy policy and a data-deletion request flow.`;
        case "contact":
          return `${lead}Contact details switch on encryption at rest, a privacy policy page and a data-deletion request flow.`;
        case "none":
          return `${lead}With no personal data the app needs no accounts database, and most privacy rules stay off.`;
        default:
          return `${lead}What you store decides how the database is protected and which privacy pages you need.`;
      }
    },
  },
  {
    id: "photoContent",
    section: "data",
    kind: "single",
    title: "Can those photos or files show faces, house numbers or documents?",
    help: "",
    options: [
      { id: "often", label: "Yes, often" },
      { id: "sometimes", label: "Sometimes" },
      { id: "no", label: "No, equipment only" },
    ],
    decide: { pick: "sometimes", because: "We assume they sometimes do and store them encrypted." },
    when: (a) => has(a, "features", "uploads"),
    followUpOf: "personal",
    basedOn: "day",
  },
  {
    id: "sensitiveKinds",
    section: "data",
    kind: "multi",
    title: "Which sensitive details?",
    help: "Each one adds its own protections.",
    options: [
      { id: "health", label: "Health or medical" },
      { id: "financial", label: "Bank or card details" },
      { id: "ids", label: "Government IDs" },
      { id: "location", label: "Exact location" },
      { id: "children", label: "Data about children" },
    ],
    when: (a) => resolved(a, "personal") === "sensitive",
    skippedNote: "Sensitive data types: no sensitive data stored",
  },
  {
    id: "payments",
    section: "data",
    kind: "single",
    title: "How will people pay?",
    help: "Who handles card numbers decides how much of PCI DSS applies to you.",
    options: [
      { id: "hosted", label: "A hosted checkout", hint: "Stripe, PayPal or PayMongo shows the card form" },
      { id: "inapp", label: "Card form in our app", hint: "We collect card numbers ourselves" },
      { id: "invoice", label: "Invoices, paid outside the app" },
    ],
    decide: { pick: "hosted", because: "A hosted checkout keeps card numbers off your servers entirely." },
    why: "With a hosted checkout, card numbers never reach your servers and PCI DSS shrinks to a short self-assessment.",
    when: takesPayments,
    skippedNote: "Payments: the app doesn't take payments",
  },
  {
    id: "retention",
    section: "data",
    kind: "single",
    title: "When someone closes their account, what happens to their data?",
    help: "Most privacy laws require deleting it unless you have a reason to keep it.",
    options: [
      { id: "now", label: "Delete it right away" },
      { id: "30d", label: "Delete it after 30 days", hint: "Gives people time to change their mind" },
      { id: "keep", label: "Keep some for legal reasons", hint: "Invoices, tax or medical records" },
    ],
    decide: { pick: "30d", because: "A 30-day grace period is the usual safe default." },
    when: storesPeople,
    skippedNote: "Data retention: no personal data stored",
  },

  // ---------- Design ----------
  {
    id: "brand",
    section: "design",
    kind: "single",
    title: "What do you have for branding?",
    help: "We build the design system from whatever you have.",
    options: [
      { id: "guide", label: "A brand guide", hint: "Logo, colors, fonts and rules" },
      { id: "logo", label: "A logo and colors" },
      { id: "nothing", label: "Nothing yet" },
    ],
  },
  {
    id: "style",
    section: "design",
    kind: "single",
    title: "How should it feel?",
    help: "This sets the starting point for type, color and spacing.",
    options: [
      { id: "calm", label: "Calm and simple" },
      { id: "bold", label: "Bold and lively" },
      { id: "formal", label: "Formal and trustworthy" },
    ],
    decide: { pick: "calm", because: "Calm and simple is easiest to use and to change later." },
    when: (a) => str(a, "brand") !== "guide",
    skippedNote: "Visual style: your brand guide decides it",
  },
  {
    id: "a11y",
    section: "design",
    kind: "single",
    title: "What accessibility level should it meet?",
    help: "Accessibility means people using screen readers, keyboards or zoom can use the app too.",
    options: [
      { id: "aa", label: "WCAG 2.2 AA", hint: "The level most laws and contracts ask for" },
      { id: "aaa", label: "WCAG 2.2 AAA", hint: "Stricter; for public services and health" },
    ],
    decide: { pick: "aa", because: "AA is what most laws and procurement rules require." },
  },
  {
    id: "languages",
    section: "design",
    kind: "single",
    title: "Which languages does it need?",
    help: "Adding languages later is cheap if we plan for it now.",
    options: [
      { id: "one", label: "One language" },
      { id: "two", label: "Two languages" },
      { id: "many", label: "Three or more" },
    ],
  },

  // ---------- Technical ----------
  {
    id: "offline",
    section: "technical",
    kind: "single",
    title: "Will people use it with poor or no signal?",
    help: "Working offline means saving changes on the phone and syncing them later.",
    options: [
      { id: "yes", label: "Yes, often", hint: "Basements, rural areas, travel" },
      { id: "sometimes", label: "Sometimes" },
      { id: "no", label: "No, always online" },
    ],
    decide: { pick: "sometimes", because: "We cache the last data so it opens without signal, without full sync." },
    when: (a) => isMobile(a) || str(a, "kind") === "webapp",
    skippedNote: "Offline use: not needed for this kind of app",
  },
  {
    id: "existing",
    section: "technical",
    kind: "single",
    title: "Does it need to work with something you already have?",
    help: "Existing data or systems shape the backend more than anything else.",
    options: [
      { id: "none", label: "No, start fresh" },
      { id: "db", label: "An existing database" },
      { id: "api", label: "An existing system with an API" },
      { id: "replace", label: "It replaces an app we have" },
    ],
  },
  {
    id: "integrations",
    section: "technical",
    kind: "multi",
    title: "Which services should it connect to?",
    help: "Pick any you already use. Skip this if none apply.",
    options: [
      { id: "gcal", label: "Google Calendar" },
      { id: "email", label: "Email sending" },
      { id: "sms", label: "SMS" },
      { id: "maps", label: "Google Maps" },
      { id: "accounting", label: "Accounting (QuickBooks, Xero)" },
    ],
    when: (a) => !isWebsite(a),
    skippedNote: "Integrations: websites keep to a contact form",
  },
  {
    id: "realtime",
    section: "technical",
    kind: "single",
    title: "Do people need to see changes the moment they happen?",
    help: "Like a chat or a live job board, without refreshing.",
    options: [
      { id: "yes", label: "Yes, live updates" },
      { id: "no", label: "No, refreshing is fine" },
    ],
    decide: { pick: "no", because: "Live updates add cost; notifications usually cover the need." },
    when: (a) => has(a, "features", "messaging"),
    skippedNote: "Live updates: no messaging",
  },
  {
    id: "hosting",
    section: "technical",
    kind: "single",
    title: "Where should it run?",
    help: "All options get backups, HTTPS and monitoring.",
    options: [
      { id: "managed", label: "Managed hosting", hint: "Least to look after, a fair monthly price" },
      { id: "cloud", label: "Our own cloud account", hint: "AWS, Google Cloud or Azure" },
      { id: "cheap", label: "Cheapest that works", hint: "Fine for small or early apps" },
    ],
    decide: { pick: "managed", because: "Managed hosting needs no server upkeep, which suits most teams." },
  },

  // ---------- Operations ----------
  {
    id: "team",
    section: "operations",
    kind: "single",
    title: "Who looks after it after launch?",
    help: "This decides how much we automate and how the docs are written.",
    options: [
      { id: "me", label: "Just me" },
      { id: "team", label: "Our developers" },
      { id: "agency", label: "An agency or freelancer" },
    ],
  },
  {
    id: "downtime",
    section: "operations",
    kind: "single",
    title: "If it's down for an hour, how bad is that?",
    help: "Sets backups, monitoring and how fast problems page someone.",
    options: [
      { id: "low", label: "Annoying", hint: "People try again later" },
      { id: "mid", label: "Costly", hint: "We lose sales or bookings" },
      { id: "high", label: "Serious", hint: "Safety, health or contracts depend on it" },
    ],
    decide: { pick: "mid", because: "Daily backups and alerts during business hours fit most apps." },
  },
  {
    id: "support",
    section: "operations",
    kind: "single",
    title: "How will users get help?",
    help: "",
    options: [
      { id: "email", label: "Email" },
      { id: "chat", label: "Chat inside the app" },
      { id: "none", label: "Not at first" },
    ],
    when: (a) => str(a, "audience") !== "staff",
    skippedNote: "User support: only your staff use it",
  },
  {
    id: "analytics",
    section: "operations",
    kind: "single",
    title: "Do you want to see how people use it?",
    help: "Usage analytics show which features people use and where they get stuck.",
    options: [
      { id: "yes", label: "Yes, privacy-friendly analytics" },
      { id: "no", label: "No analytics" },
    ],
    decide: { pick: "yes", because: "Cookie-free analytics tell you what to build next without consent banners." },
  },
];

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

export function questionById(id: string): Question | undefined {
  return BY_ID.get(id);
}

export function optionsFor(q: Question, a: Answers): Option[] {
  return typeof q.options === "function" ? q.options(a) : q.options ?? [];
}

export function isAsked(q: Question, a: Answers): boolean {
  return !q.when || q.when(a);
}

export function isAnswered(q: Question, a: Answers): boolean {
  const v = a[q.id];
  if (Array.isArray(v)) return v.length > 0 || q.kind === "multi";
  return typeof v === "string" && v.trim() !== "";
}

/** The answer with "decide for me" replaced by the option we picked. */
export function resolved(a: Answers, id: string): string {
  const v = a[id];
  if (v === DECIDE) return BY_ID.get(id)?.decide?.pick ?? "";
  return typeof v === "string" ? v : "";
}

/** Asked questions in order, follow-ups straight after their parent. */
export function askedQuestions(a: Answers): Question[] {
  const asked = QUESTIONS.filter((q) => isAsked(q, a));
  const main = asked.filter((q) => !q.followUpOf);
  return main.flatMap((q) => [q, ...asked.filter((f) => f.followUpOf === q.id)]);
}

export interface IntakeProgress {
  answered: number;
  total: number;
  complete: boolean;
  /** First main question with something unanswered (itself or a follow-up). */
  next: Question | null;
}

export function intakeProgress(a: Answers): IntakeProgress {
  const asked = askedQuestions(a);
  const answered = asked.filter((q) => isAnswered(q, a)).length;
  const firstOpen = asked.find((q) => !isAnswered(q, a));
  const next = firstOpen ? (firstOpen.followUpOf ? BY_ID.get(firstOpen.followUpOf)! : firstOpen) : null;
  return { answered, total: asked.length, complete: !firstOpen, next };
}

export function skippedTopics(a: Answers): string[] {
  return QUESTIONS.filter((q) => q.skippedNote && !isAsked(q, a)).map((q) => q.skippedNote!);
}

export function answerLabel(q: Question, a: Answers): string {
  const v = a[q.id];
  const opts = optionsFor(q, a);
  if (v === DECIDE) {
    const pick = opts.find((o) => o.id === q.decide?.pick)?.label;
    return pick ? `${pick} (decided for you)` : "Decided for you";
  }
  if (Array.isArray(v)) return v.map((id) => opts.find((o) => o.id === id)?.label ?? id).join(", ");
  return opts.find((o) => o.id === v)?.label ?? (typeof v === "string" ? v : "");
}

// ---------------------------------------------------------------------------
// Blueprint
// ---------------------------------------------------------------------------

export interface Standard {
  id: string;
  label: string;
  /** One line on why it applies. */
  reason: string;
}

export interface StackRow {
  role: string;
  choice: string;
  reason: string;
}

export interface Blueprint {
  title: string;
  facts: string[];
  screens: number | null;
  hosting: string | null;
  stack: StackRow[];
  standards: Standard[];
  /** Standards a reader might expect, and why they stay off. */
  offNotes: string[];
  mvp: string[];
  later: string[];
  decisions: { question: string; choice: string; because: string }[];
}

const KIND_TITLE: Record<string, string> = {
  website: "Website",
  webapp: "Web app",
  mobile: "Mobile app",
  store: "Online store",
  saas: "SaaS product",
  internal: "Internal tool",
};

export function kindLabel(a: Answers): string {
  return KIND_TITLE[str(a, "kind")] ?? "New app";
}

function privacyLaw(a: Answers): { label: string; long: string } | null {
  switch (str(a, "region")) {
    case "ph":
      return { label: "PH Data Privacy Act", long: "the Data Privacy Act of 2012" };
    case "eu":
    case "world":
      return { label: "GDPR", long: "the GDPR" };
    case "us":
      return { label: "CCPA", long: "the CCPA and state privacy laws" };
    default:
      return null;
  }
}

function frontend(a: Answers): StackRow | null {
  switch (str(a, "kind")) {
    case "mobile":
      return { role: "App", choice: "Expo (React Native)", reason: "One codebase ships to iOS and Android." };
    case "website":
      return { role: "Site", choice: "Astro", reason: "Static pages load fast and cost almost nothing to host." };
    case "store":
      return { role: "Store", choice: "Shopify Hydrogen", reason: "Shopify runs checkout, stock and taxes for you." };
    case "":
      return null;
    default:
      return { role: "App", choice: "Next.js", reason: "One framework for pages, forms and the API layer." };
  }
}

function backend(a: Answers): StackRow | null {
  const kind = str(a, "kind");
  if (!kind) return null;
  if (kind === "website" && !has(a, "features", "accounts")) {
    return { role: "Backend", choice: "None needed", reason: "Forms go to a hosted form service." };
  }
  if (kind === "store") {
    return { role: "Backend", choice: "Shopify", reason: "Products, orders and customers live in Shopify." };
  }
  if (resolved(a, "hosting") === "cloud") {
    return { role: "Backend", choice: "NestJS · Postgres", reason: "Runs in your own cloud account." };
  }
  if (str(a, "existing") === "db") {
    return { role: "Backend", choice: "Node API · your database", reason: "Reads and writes your existing data." };
  }
  return { role: "Backend", choice: "Supabase · Postgres", reason: "Auth, database and storage in one service." };
}

export function buildBlueprint(a: Answers, name: string): Blueprint {
  const kind = str(a, "kind");
  const mobile = isMobile(a);
  const features = list(a, "features");
  const personal = resolved(a, "personal");
  const offline = ["yes", "sometimes"].includes(resolved(a, "offline"));

  // ---- Facts line
  const facts: string[] = [];
  if (mobile) {
    const p = resolved(a, "platforms");
    facts.push(p === "ios" ? "iOS" : p === "android" ? "Android" : "iOS + Android");
  } else if (kind) facts.push(kindLabel(a));
  const roles = str(a, "roles");
  if (roles) facts.push(roles === "1" ? "1 user role" : roles === "2" ? "2 user roles" : "3+ user roles");
  if (resolved(a, "offline") === "yes") facts.push("works offline");

  // ---- Stack
  const stack: StackRow[] = [];
  const fe = frontend(a);
  const be = backend(a);
  if (fe) stack.push(fe);
  if (be) stack.push(be);
  if (has(a, "features", "uploads")) {
    const sensitive = resolved(a, "photoContent") !== "no" || personal === "sensitive";
    stack.push(
      sensitive
        ? { role: "Photos", choice: "Encrypted storage", reason: "Photos may show people or documents." }
        : { role: "Files", choice: "Object storage", reason: "Cheap, durable storage behind a CDN." }
    );
  }
  if (takesPayments(a) && kind !== "store") {
    const p = resolved(a, "payments");
    if (p === "hosted") stack.push({ role: "Payments", choice: "Stripe Checkout", reason: "Card numbers never touch your servers." });
    if (p === "inapp") stack.push({ role: "Payments", choice: "Stripe Elements", reason: "Card form inside the app." });
  }
  if (mobile && offline) {
    stack.push({ role: "Offline", choice: "Local DB + sync", reason: "Changes save on the phone and sync later." });
  }
  if (resolved(a, "realtime") === "yes") {
    stack.push({ role: "Live updates", choice: "Realtime channels", reason: "Screens update without refreshing." });
  }

  // ---- Standards
  const standards: Standard[] = [];
  const offNotes: string[] = [];
  if (kind) standards.push({ id: "baseline", label: "Baseline", reason: "Security, testing and docs every app needs." });
  if (mobile) standards.push({ id: "mobile", label: "Mobile app", reason: "OWASP MASVS for apps on phones." });
  else if (kind && kind !== "website") standards.push({ id: "web", label: "Web app", reason: "OWASP ASVS for apps people sign in to." });
  if (offline) standards.push({ id: "offline", label: "Offline sync", reason: "Conflict handling and on-device encryption." });
  const law = privacyLaw(a);
  if (law && personal && personal !== "none") {
    standards.push({ id: "privacy", label: law.label, reason: `Your users are in ${REGIONS[str(a, "region")]}.` });
  }
  if (has(a, "sensitiveKinds", "health") && str(a, "region") === "us") {
    standards.push({ id: "hipaa", label: "HIPAA", reason: "Health data about US patients." });
  }
  const pay = resolved(a, "payments");
  if (takesPayments(a) && (pay === "inapp" || pay === "hosted" || kind === "store")) {
    standards.push(
      pay === "inapp"
        ? { id: "pci", label: "PCI DSS", reason: "The app collects card numbers itself." }
        : { id: "pci", label: "PCI DSS SAQ-A", reason: "A hosted checkout keeps the scope small." }
    );
  } else if (kind && !takesPayments(a)) {
    offNotes.push("Card payments are not handled here, so PCI DSS stays off.");
  }
  const a11y = resolved(a, "a11y");
  if (a11y) standards.push({ id: "wcag", label: a11y === "aaa" ? "WCAG 2.2 AAA" : "WCAG 2.2 AA", reason: "Accessibility target you chose." });

  // ---- Features
  const featureLabel = (id: string) => FEATURES.find((f) => f.id === id)?.label ?? id;
  // Until the release split is answered, everything counts as first release.
  const mvpIds = isAsked(questionById("mvp")!, a) && Array.isArray(a.mvp) ? list(a, "mvp") : features;
  const mvp = features.filter((f) => mvpIds.includes(f)).map(featureLabel);
  const later = features.filter((f) => !mvpIds.includes(f)).map(featureLabel);

  // ---- Size estimates (rough on purpose; shown as estimates)
  let screens: number | null = null;
  if (kind) {
    const base: Record<string, number> = { website: 5, webapp: 6, mobile: 6, store: 10, saas: 8, internal: 5 };
    screens = base[kind] + features.length * 2 + (Number(roles) > 1 ? (Number(roles) - 1) * 2 : 0);
    if (has(a, "features", "accounts")) screens += 2;
    if (personal && personal !== "none") screens += 1; // privacy and data-deletion pages
  }

  let hosting: string | null = null;
  const scale = resolved(a, "scale");
  if (kind && scale) {
    const ranges: Record<string, [number, number]> = { s: [0, 25], m: [25, 80], l: [80, 300], xl: [300, 1500] };
    let [lo, hi] = ranges[scale];
    if (resolved(a, "hosting") === "cheap") [lo, hi] = [Math.round(lo * 0.6), Math.round(hi * 0.6)];
    if (resolved(a, "hosting") === "cloud") [lo, hi] = [Math.round(lo * 1.4) + 10, Math.round(hi * 1.4)];
    if (kind === "website") [lo, hi] = [0, Math.max(20, Math.round(hi / 4))];
    hosting = `$${lo}–${hi}`;
  }

  const decisions = QUESTIONS.filter((q) => a[q.id] === DECIDE && q.decide && isAsked(q, a)).map((q) => ({
    question: q.title,
    choice: optionsFor(q, a).find((o) => o.id === q.decide!.pick)?.label ?? q.decide!.pick,
    because: q.decide!.because,
  }));

  return {
    title: name,
    facts,
    screens,
    hosting,
    stack,
    standards,
    offNotes,
    mvp,
    later,
    decisions,
  };
}

// ---------------------------------------------------------------------------
// Build plan: one slice (one pull request) per first-release feature
// ---------------------------------------------------------------------------

const STORIES: Record<string, (a: Answers) => string[]> = {
  accounts: (a) => [
    "A person can sign up and sign in with email and password",
    "A signed-in person can sign out and reset a forgotten password",
    ...(Number(str(a, "roles")) > 1 ? ["Each role only sees the screens and data meant for it"] : []),
  ],
  bookings: () => [
    "A person can see available times and book one",
    "A person can reschedule or cancel a booking",
    "Staff see the day's bookings in a schedule view",
  ],
  payments: (a) => [
    resolved(a, "payments") === "invoice"
      ? "Staff can create an invoice and mark it paid"
      : "A person can pay through the hosted checkout and gets a receipt",
    "Failed and refunded payments are recorded and shown",
  ],
  uploads: (a) => [
    "A person can attach photos or files to a record",
    resolved(a, "photoContent") === "no"
      ? "Uploaded files are stored in object storage behind signed URLs"
      : "Uploaded files are stored encrypted and only visible to people allowed to see the record",
  ],
  messaging: (a) => [
    "People get a notification when something they're involved in changes",
    resolved(a, "realtime") === "yes"
      ? "Screens update live without refreshing"
      : "People can choose which notifications they receive",
  ],
  location: () => ["A record can store an address and show it on a map", "People can get directions to it"],
  search: () => ["People can search records by name and key fields", "Results can be filtered and sorted"],
  reports: () => ["Staff see a dashboard of the key numbers", "Staff can export the data behind it as CSV"],
};

/** The features in their first-release order, each as a slice with its stories. */
export function slicePlan(a: Answers): { title: string; stories: string[] }[] {
  const blueprint = buildBlueprint(a, "");
  const ids = FEATURES.filter((f) => blueprint.mvp.includes(f.label)).map((f) => f.id);
  // Accounts first: almost everything else depends on who is signed in.
  ids.sort((x, y) => (x === "accounts" ? -1 : y === "accounts" ? 1 : 0));
  return ids.map((id) => ({ title: FEATURES.find((f) => f.id === id)!.label, stories: STORIES[id](a) }));
}

/** Plain-text spec the builder works from: the Blueprint plus every answer. */
export function specText(a: Answers, name: string): string {
  const bp = buildBlueprint(a, name);
  const answered = askedQuestions(a)
    .filter((q) => isAnswered(q, a))
    .map((q) => `- ${q.title} ${answerLabel(q, a)}`);
  return [
    `${name}: ${str(a, "pitch") || kindLabel(a)}`,
    `Platform: ${bp.facts.join(", ")}`,
    `Stack: ${bp.stack.map((s) => `${s.role}: ${s.choice}`).join("; ")}`,
    `Standards to meet: ${bp.standards.map((s) => s.label).join(", ")}`,
    `First release: ${bp.mvp.join(", ")}`,
    bp.later.length ? `Later releases (don't build yet): ${bp.later.join(", ")}` : "",
    "",
    "Intake answers:",
    ...answered,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
