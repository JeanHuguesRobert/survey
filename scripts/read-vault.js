import { loadConfig } from "./lib/config.js";

async function main() {
  const config = await loadConfig();
  console.log("\n==================================================");
  console.log("             VAULT CONFIGURATION KEYS             ");
  console.log("==================================================\n");
  for (const [key, val] of Object.entries(config)) {
    if (
      key.includes("key") ||
      key.includes("token") ||
      key.includes("secret") ||
      key.includes("api")
    ) {
      console.log(`${key}: ${val ? "present" : "empty"}`);
    } else {
      const type = Array.isArray(val) ? "array" : typeof val;
      console.log(`${key}: ${val == null ? "empty" : `present (${type})`}`);
    }
  }
  console.log();
}
main().catch(console.error);
