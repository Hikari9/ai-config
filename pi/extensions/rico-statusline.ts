/**
 * rico-statusline — Claude Code style footer for pi.
 *
 *   line 1  model (thinking level)  ·  api $X left · today $Y (mtd when no credit vars)
 *   line 2  ~/cwd | git branch
 *   line 3  ctx: 12k ████░░░░ [dir]  ·  session $cost
 *   extra   ctx.ui.setStatus() texts (e.g. graft, rtk) on their own lines
 *
 * Spend comes from the Anthropic Admin API cost report, filtered to the
 * workspace in ~/.env (ANTHROPIC_WORKSPACE_ID). Credentials are read from
 * ~/.env at runtime, held only in local variables, and never printed, logged,
 * or written to the cache. Rendering never waits on the network: it reads the
 * cached numbers; a background fetch refreshes them at most every 5 min.
 */
import { promises as fs, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { ExtensionAPI, ExtensionContext, ReadonlyFooterDataProvider } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import type { TUI } from "@earendil-works/pi-tui";

const HOME = homedir();
const ENV_FILE = join(HOME, ".env");
const CACHE_FILE = join(HOME, ".pi", "agent", "cache", "rico-statusline-api.json");
const TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_PAGES = 5;
// Admin API cost_report `amount` is a decimal string in USD cents (lowest unit). Unverified against a non-zero row.
const AMOUNT_DIVISOR = 100;

const RESET = "\u001b[0m";
const DIM = "\u001b[2m";

type Spend = { checkedAt: number; ok: boolean; today: number; mtd: number; day: string; month: string; credits?: number };

let spend: Spend | undefined;
let sessionCost = 0;
let inFlight: Promise<void> | undefined;
let timer: ReturnType<typeof setInterval> | undefined;

// Latest session-bound handles. Footer render reads these, so a session swap never leaves it on a stale ctx.
let live: { pi: ExtensionAPI; ctx: ExtensionContext; tui?: TUI; footerData?: ReadonlyFooterDataProvider } | undefined;

/** Read KEY=VALUE pairs from ~/.env. Returns values only in the caller's local scope. */
function readDotEnv(): Record<string, string> {
	const out: Record<string, string> = {};
	try {
		for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
			const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
			if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
		}
	} catch {
		// no ~/.env: handled by caller
	}
	return out;
}

function loadCacheFromDisk(): void {
	try {
		const parsed = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Spend;
		if (parsed && typeof parsed.checkedAt === "number") spend = parsed;
	} catch {
		// no cache yet
	}
}

async function saveCache(): Promise<void> {
	if (!spend) return;
	try {
		await fs.mkdir(join(HOME, ".pi", "agent", "cache"), { recursive: true });
		await fs.writeFile(CACHE_FILE, JSON.stringify(spend));
	} catch {
		// cache is best-effort
	}
}

/** UTC day and month keys, matching the cost report's UTC daily buckets. */
function utcKeys(now: Date): { day: string; month: string; monthStart: string } {
	const day = now.toISOString().slice(0, 10);
	const month = day.slice(0, 7);
	return { day, month, monthStart: `${month}-01T00:00:00Z` };
}

/** Fetch month-to-date cost buckets from the Admin API and sum the configured workspace. */
/** Parse ANTHROPIC_CREDIT_AS_OF as Manila (+08:00) when it carries no timezone. */
function parseAsOf(v: string | undefined): Date | undefined {
	if (!v) return undefined;
	const t = v.trim();
	const iso = /^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T00:00:00+08:00` : /(Z|[+-]\d{2}:?\d{2})$/.test(t) ? t : `${t}+08:00`;
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? undefined : d;
}

async function fetchSpend(adminKey: string, workspaceId: string, balance?: number, asOf?: Date): Promise<Omit<Spend, "checkedAt">> {
	const now = new Date();
	const { day, month, monthStart } = utcKeys(now);
	// Daily buckets only: the bucket containing AS_OF counts in full (credits shown err low).
	const asOfDay = asOf ? `${asOf.toISOString().slice(0, 10)}T00:00:00Z` : undefined;
	const startAt = asOfDay && asOfDay < monthStart ? asOfDay : monthStart;
	let sinceAsOf = 0;
	let today = 0;
	let mtd = 0;
	let page: string | undefined;
	for (let i = 0; i < MAX_PAGES; i++) {
		const params = new URLSearchParams({ starting_at: startAt, bucket_width: "1d", limit: "31" });
		params.append("group_by[]", "workspace_id");
		if (page) params.set("page", page);
		const res = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${params}`, {
			headers: { "x-api-key": adminKey, "anthropic-version": "2023-06-01" },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		if (!res.ok) throw new Error(`cost_report HTTP ${res.status}`);
		const body = (await res.json()) as {
			data: { starting_at: string; results: { amount: string; currency?: string; workspace_id?: string }[] }[];
			has_more?: boolean;
			next_page?: string | null;
		};
		for (const bucket of body.data ?? []) {
			const bucketDay = bucket.starting_at.slice(0, 10);
			for (const r of bucket.results ?? []) {
				if (r.workspace_id !== workspaceId) continue;
				const dollars = (Number(r.amount) || 0) / AMOUNT_DIVISOR;
				if (bucket.starting_at >= monthStart) mtd += dollars;
				if (bucketDay === day) today += dollars;
				if (asOfDay && bucket.starting_at >= asOfDay) sinceAsOf += dollars;
			}
		}
		if (!body.has_more || !body.next_page) break;
		page = body.next_page;
	}
	const credits = balance !== undefined && asOfDay ? balance - sinceAsOf : undefined;
	return { ok: true, today, mtd, day, month, credits };
}

/** Background refresh, TTL-gated to 5 min. Failures keep the last good numbers visible as 'n/a'. */
function refreshSpend(force = false): Promise<void> {
	if (inFlight) return inFlight;
	if (!force && spend && Date.now() - spend.checkedAt < TTL_MS) return Promise.resolve();
	inFlight = (async () => {
		try {
			const env = readDotEnv();
			const adminKey = env.ANTHROPIC_ADMIN_API_KEY;
			const workspaceId = env.ANTHROPIC_WORKSPACE_ID;
			if (!adminKey || !workspaceId) {
				spend = { checkedAt: Date.now(), ok: false, today: 0, mtd: 0, ...utcKeys(new Date()) };
			} else {
				try {
					const bal = env.ANTHROPIC_CREDIT_BALANCE ? Number(env.ANTHROPIC_CREDIT_BALANCE) : NaN;
					const r = await fetchSpend(adminKey, workspaceId, Number.isFinite(bal) ? bal : undefined, parseAsOf(env.ANTHROPIC_CREDIT_AS_OF));
					spend = { checkedAt: Date.now(), ...r };
				} catch {
					// Error text may echo request details; keep it out of the footer and cache.
					spend = { checkedAt: Date.now(), ok: false, today: 0, mtd: 0, ...utcKeys(new Date()) };
				}
			}
			await saveCache();
		} finally {
			inFlight = undefined;
		}
		live?.tui?.requestRender();
	})();
	return inFlight;
}

function computeSessionCost(ctx: ExtensionContext): void {
	let c = 0;
	try {
		for (const e of ctx.sessionManager.getBranch()) {
			if (e.type === "message" && e.message.role === "assistant") {
				c += (e.message as any).usage?.cost?.total ?? 0;
			} else if (e.type === "usage") {
				c += (e as any).usage?.cost?.total ?? 0;
			}
		}
	} catch {
		// keep last value
	}
	sessionCost = c;
}

// Claude Code's bar: 8 cells, eighth-block partial, colour by fill level.
function bar(pct: number, width = 8): string {
	const q = Math.min(100, Math.max(0, pct));
	const eighths = Math.round((q / 100) * width * 8);
	const full = Math.floor(eighths / 8);
	const rem = eighths % 8;
	const part = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"][rem];
	const empty = Math.max(0, width - full - (rem > 0 ? 1 : 0));
	const color = q >= 80 ? "\u001b[38;5;210m" : q >= 50 ? "\u001b[38;5;222m" : "\u001b[38;5;114m";
	return `${color}${"█".repeat(full)}${part}${DIM}${"░".repeat(empty)}${RESET}`;
}

const usd = (n: number) => `$${n.toFixed(2)}`;

function apiText(): string {
	if (!spend) return "api …";
	if (!spend.ok) return "api n/a";
	if (spend.credits !== undefined) return `api ${usd(Math.max(0, spend.credits))} left · today ${usd(spend.today)}`;
	return `api today ${usd(spend.today)} · mtd ${usd(spend.mtd)}`;
}

function renderLines(width: number): string[] {
	if (!live) return [];
	const { pi, ctx, footerData } = live;

	// Line 1: model (effort) · API spend
	let effort: string | undefined = ctx.thinkingLevel;
	if (!effort) {
		try {
			effort = pi.getThinkingLevel();
		} catch {
			effort = undefined;
		}
	}
	const modelRaw = ctx.model?.name ?? ctx.model?.id ?? "no model";
	const modelName = modelRaw.split(" (")[0];
	const line1 = [`${modelName}${effort ? ` (${effort})` : ""}`, apiText()].join(" · ");

	// Line 2: cwd | branch (footer data reads .git files directly, no git process, no locks)
	const cwd = ctx.cwd ?? "";
	let dpath = cwd;
	if (cwd === HOME) dpath = "~";
	else if (cwd.startsWith(HOME + "/")) dpath = `~${cwd.slice(HOME.length)}`;
	let branch: string | null = null;
	try {
		branch = footerData?.getGitBranch() ?? null;
	} catch {
		branch = null;
	}
	const line2 = branch ? `${dpath} | ${branch}` : dpath;

	// Line 3: ctx bar · session cost
	let ctxText = "ctx: —";
	try {
		const u = ctx.getContextUsage();
		if (u) {
			const tok = u.tokens != null ? `${Math.round(u.tokens / 1000)}k ` : "";
			ctxText = `ctx: ${tok}${bar(u.percent ?? 0)} [${basename(cwd) || "/"}]`;
		}
	} catch {
		// keep placeholder
	}
	const line3 = `${ctxText} · ${usd(sessionCost)}`;

	const lines = [line1, line2, line3];

	// Extension statuses (graft, rtk, ...) keep their own line, as the built-in footer shows them.
	try {
		const statuses = [...(footerData?.getExtensionStatuses().values() ?? [])].filter(Boolean);
		if (statuses.length) lines.push(statuses.join(" · "));
	} catch {
		// ignore
	}

	return lines.map((l) => truncateToWidth(l, width));
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (timer) clearInterval(timer);
		live = { pi, ctx };
		loadCacheFromDisk();
		computeSessionCost(ctx);

		ctx.ui.setFooter((tui, _theme, footerData) => {
			if (live) {
				live.tui = tui;
				live.footerData = footerData;
			}
			const unsub = footerData.onBranchChange(() => tui.requestRender());
			return {
				dispose() {
					unsub();
				},
				invalidate() {},
				render(width: number): string[] {
					return renderLines(width);
				},
			};
		});

		timer = setInterval(() => void refreshSpend(), TTL_MS);
		timer.unref?.();
		void refreshSpend();
	});

	const refreshView = (ctx: ExtensionContext) => {
		if (!live) return;
		live.ctx = ctx;
		computeSessionCost(ctx);
		live.tui?.requestRender();
	};

	pi.on("turn_end", async (_event, ctx) => {
		refreshView(ctx);
		void refreshSpend(); // TTL-gated: a real Admin API call at most every 5 min
	});
	pi.on("agent_end", async (_event, ctx) => {
		refreshView(ctx);
	});
	pi.on("model_select", async (_event, ctx) => {
		refreshView(ctx);
	});
	pi.on("thinking_level_select", async (_event, ctx) => {
		refreshView(ctx);
	});

	pi.on("session_shutdown", async () => {
		if (timer) clearInterval(timer);
		timer = undefined;
		live = undefined;
	});
}
