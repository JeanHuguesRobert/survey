// File: packages/cop-kernel/src/env.js
// Description:
//   Small helper to read environment variables in both Node (process.env)
//   and Deno (Deno.env.get).

export function getEnv(name) {
  // Deno (Netlify Edge, etc.)
  try {
    // eslint-disable-next-line no-undef
    if (typeof Deno !== "undefined" && Deno.env && typeof Deno.env.get === "function") {
      // eslint-disable-next-line no-undef
      const v = Deno.env.get(name);
      if (typeof v === "string") return v;
    }
  } catch (_err) {
    // ignore
  }

  // Node.js
  if (
    typeof process !== "undefined" &&
    process.env &&
    Object.prototype.hasOwnProperty.call(process.env, name)
  ) {
    return process.env[name];
  }

  return undefined;
}
