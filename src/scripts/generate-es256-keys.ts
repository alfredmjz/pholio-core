import { generateKeyPair, exportJWK, SignJWT } from "jose";
import * as fs from "fs";
import * as path from "path";

async function generateKeys() {
	console.log("Generating ES256 Key Pair...");

	// 1. Generate Key Pair
	const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });

	// 2. Export to JWK
	const privateJwk = await exportJWK(privateKey);
	const publicJwk = await exportJWK(publicKey);

	// Add kid (Key ID) and standard metadata
	const kid = "local-es256-key-1";
	privateJwk.kid = kid;
	publicJwk.kid = kid;
	privateJwk.use = "sig";
	publicJwk.use = "sig";
	privateJwk.alg = "ES256";
	publicJwk.alg = "ES256";
	privateJwk.key_ops = ["sign"];
	publicJwk.key_ops = ["verify"];

	// 3. Create signing_keys.json structure for Supabase GoTrue
	// GoTrue expects an Array of JWKs
	const signingKeys = [privateJwk];

	const keysPath = path.join(process.cwd(), "..", "..", "supabase", "signing_keys.json");

	// Try to locate the correct directory (handling execution from root vs src)
	// Defaulting to assuming run from project root or checks
	// Let's make it robust:
	let finalPath = "supabase/signing_keys.json"; // Default relative to root
	if (fs.existsSync(path.join(process.cwd(), "supabase"))) {
		finalPath = path.join(process.cwd(), "supabase", "signing_keys.json");
	} else if (fs.existsSync(path.join(process.cwd(), "..", "supabase"))) {
		finalPath = path.join(process.cwd(), "..", "supabase", "signing_keys.json");
	}

	if (!fs.existsSync(path.dirname(finalPath))) {
		// If we can't find it easily, just use the relative path that likely works or log warning
		console.warn("Could not find supabase directory automatically. Writing to ./signing_keys.json");
		finalPath = "./signing_keys.json";
	}

	fs.writeFileSync(finalPath, JSON.stringify(signingKeys, null, 2));
	console.log(`✅ Wrote signing keys to ${finalPath}`);

	// 4. Generate Tokens
	// Anon Token
	const anonToken = await new SignJWT({
		role: "anon",
		iss: "supabase",
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
	})
		.setProtectedHeader({ alg: "ES256", kid: kid })
		.sign(privateKey);

	// Service Role Token
	const serviceToken = await new SignJWT({
		role: "service_role",
		iss: "supabase",
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
	})
		.setProtectedHeader({ alg: "ES256", kid: kid })
		.sign(privateKey);

	console.log("\n--- COPY THESE TO YOUR .env.local ---");
	console.log(`LOCAL_SUPABASE_PUBLISHABLE_KEY=${anonToken}`);
	console.log(`LOCAL_SUPABASE_SERVICE_ROLE_KEY=${serviceToken}`);
	console.log("-------------------------------------");
}

generateKeys().catch(console.error);
