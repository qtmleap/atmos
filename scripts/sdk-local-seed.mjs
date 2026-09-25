// The email is LOCAL_ACCESS_EMAIL in apps/web/vite.config.ts, so the browser on
// localhost is signed in as this same user.
// Seed the local D1 (apps/web/.wrangler) with one admin user and an access
// token, so the Python SDK can talk to the real Worker under `vite` with
// ATMOS_DEV_API=real (shell or apps/web/.env.local). Prints the plaintext token once; only its hash is stored.
// Running it again revokes nothing: it adds another token for the same user.
//   cd apps/web && bun ../../scripts/sdk-local-seed.mjs
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Same shape as generateAccessToken() in src/api/lib/auth.ts.
const token = (() => {
	let value = BigInt(`0x${randomBytes(32).toString("hex")}`);
	let body = "";
	for (let i = 0; i < 43; i++) {
		body = `${BASE62[Number(value % 62n)]}${body}`;
		value /= 62n;
	}
	return `atmos_${body}`;
})();
const tokenHash = createHash("sha256").update(token).digest("hex");
const now = Math.floor(Date.now() / 1000);
const userId = randomUUID();

const sql = `
INSERT OR IGNORE INTO users (id, handle, display_name, avatar_key, cf_access_email, role, created_at)
  VALUES ('${userId}', 'local', 'Local Dev', NULL, 'local@example.com', 'admin', ${now});
INSERT INTO access_tokens (id, user_id, token_hash, token_hint, issued_at, revoked_at)
  SELECT '${randomUUID()}', id, '${tokenHash}', 'atmos_...${token.slice(-4)}', ${now}, NULL
  FROM users WHERE handle = 'local';
`;

const result = spawnSync(
	"bunx",
	["wrangler", "d1", "execute", "atmos", "--local", "--command", sql],
	{ stdio: ["ignore", "ignore", "inherit"] },
);
if (result.status !== 0) {
	process.exit(result.status ?? 1);
}
console.log(`ATMOS_TOKEN=${token}`);
