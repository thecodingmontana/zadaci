// The server must run next to the database: every query crosses the gap between them, and a
// page makes several. vite.config.ts pins the server to SERVER_REGION and calls checkRegions on
// every build, so a deploy whose database lives somewhere else fails instead of going out slow.

/** Where Vercel runs the server. */
export const SERVER_REGION = "fra1";

/** Supabase (AWS) regions, and the Vercel region next to each. */
const NEAREST: Record<string, string> = {
	"eu-central-1": "fra1",
	"eu-central-2": "fra1",
	"eu-west-1": "dub1",
	"eu-west-2": "lhr1",
	"eu-west-3": "cdg1",
	"eu-north-1": "arn1",
	"us-east-1": "iad1",
	"us-east-2": "cle1",
	"us-west-1": "sfo1",
	"us-west-2": "pdx1",
	"ca-central-1": "yul1",
	"sa-east-1": "gru1",
	"ap-south-1": "bom1",
	"ap-southeast-1": "sin1",
	"ap-southeast-2": "syd1",
	"ap-northeast-1": "hnd1",
	"ap-northeast-2": "icn1",
	"ap-northeast-3": "kix1",
	"af-south-1": "cpt1",
	"me-central-1": "dxb1",
};

/**
 * The Vercel region next to a database, read from its address (Supabase pooler hosts name
 * their region: aws-1-eu-central-1.pooler.supabase.com). Null when the address doesn't say.
 */
export function databaseRegion(databaseUrl: string | undefined) {
	if (!databaseUrl) return null;
	let host: string;
	try {
		host = new URL(databaseUrl).hostname;
	} catch {
		return null;
	}
	const aws = host.match(
		/^aws-\d+-([a-z]+-[a-z]+-\d)\.pooler\.supabase\.com$/,
	)?.[1];
	return aws ? (NEAREST[aws] ?? `unknown (${aws})`) : null;
}

/** Throws when the database isn't next to the server; says so when it can't tell. */
export function checkRegions(databaseUrl: string | undefined) {
	const near = databaseRegion(databaseUrl);
	if (near === null) {
		if (databaseUrl && !/localhost|127\.0\.0\.1/.test(databaseUrl))
			console.warn(
				`[region] can't tell the database's region from its address; make sure it's next to ${SERVER_REGION}`,
			);
		return;
	}
	if (near !== SERVER_REGION)
		throw new Error(
			`[region] The database is next to ${near}, but the server is set to run in ${SERVER_REGION}. ` +
				"Move one of them (SERVER_REGION in src/lib/deploy-region.ts, or the Supabase project) so they match.",
		);
}
