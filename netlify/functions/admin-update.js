import { createClient } from "@supabase/supabase-js";

// This function expects the following env vars set in Netlify:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY (*** KEEP SECRET ***)

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, body: "Server misconfiguration: missing Supabase keys" };
  }

  // Create a privileged Supabase client (service role) to perform admin lookups and updates
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
  // Expect the frontend to include the requestor UUID (temporary prototype):
  // either in header `x-requestor-id` or in the JSON body as `requestorId`.
  let requestorId = event.headers["x-requestor-id"] || event.headers["X-Requestor-Id"];
  if (!requestorId) {
    try {
      const parsed = JSON.parse(event.body || "{}");
      requestorId = parsed.requestorId;
    } catch (e) {
      // ignore
    }
  }

  if (!requestorId) {
    return { statusCode: 403, body: "Forbidden: missing requestor id" };
  }

  // Validate that requestorId matches the auth user id for the contact email (weak prototype check)
  // On the server we expect the non-VITE var `CONTACT_EMAIL` to be configured; fall back to VITE_CONTACT_EMAIL if present.
  const contactEmail = process.env.CONTACT_EMAIL || process.env.VITE_CONTACT_EMAIL;
  if (!contactEmail) {
    return { statusCode: 500, body: "Server misconfiguration: missing contact email" };
  }

  try {
    // Prefer admin API to get auth user by email when available
    let contactUserId = null;
    if (
      supabase.auth &&
      supabase.auth.admin &&
      typeof supabase.auth.admin.getUserByEmail === "function"
    ) {
      const { data: contactUser, error: contactErr } =
        await supabase.auth.admin.getUserByEmail(contactEmail);
      if (contactErr || !contactUser || !contactUser.user || !contactUser.user.id) {
        return {
          statusCode: 500,
          body: "Server misconfiguration: cannot resolve contact user via auth admin API",
        };
      }
      contactUserId = contactUser.user.id;
    } else {
      // Fallback: try to resolve from the public `users` table (profiles) if present
      try {
        const { data: pubUser, error: pubErr } = await supabase
          .from("users")
          .select("id, email")
          .eq("email", contactEmail)
          .maybeSingle();
        if (pubErr || !pubUser || !pubUser.id) {
          return {
            statusCode: 500,
            body: "Server misconfiguration: cannot resolve contact user (no admin API and no profile match)",
          };
        }
        contactUserId = pubUser.id;
      } catch (pubErr2) {
        return {
          statusCode: 500,
          body: "Server misconfiguration: cannot resolve contact user (fallback failed)",
        };
      }
    }

    // Debug: expose the resolved contact user id in logs to help diagnose env mismatches
    console.log("Resolved contact user id for", contactEmail, "->", contactUserId);

    if (String(contactUserId) !== String(requestorId)) {
      return { statusCode: 403, body: "Forbidden: requestor is not the admin user" };
    }
    // allowed
  } catch (err) {
    return { statusCode: 500, body: "Server error validating admin user" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: "Invalid JSON" };
  }
  const { type, id, patch, requestorId: bodyRequestorId } = body;
  // Log incoming admin update request for debugging (avoid logging service keys)
  try {
    console.log("admin-update request", { type, id, requestorId: bodyRequestorId });
  } catch (e) {
    // ignore logging errors
  }
  if (!type || !id || !patch) {
    return { statusCode: 400, body: "Missing type/id/patch" };
  }

  // reuse the privileged `supabase` client created above

  const tableMap = {
    users: "users",
    posts: "posts",
    groups: "groups",
    comments: "comments",
    wiki: "wiki_pages",
    subscriptions: "content_subscriptions",
  };
  const table = tableMap[type] || type;

  try {
    const { data, error } = await supabase.from(table).update(patch).eq("id", id).select().single();
    if (error) {
      try {
        console.error("admin-update failed response", { type, id, error });
      } catch (e) {}
      return { statusCode: 500, body: JSON.stringify({ message: error.message, details: error }) };
    }
    try {
      console.log("admin-update success", { type, id, result: data && data.id ? "ok" : data });
    } catch (e) {}
    return { statusCode: 200, body: JSON.stringify({ data }) };
  } catch (err) {
    try {
      console.error("admin-update exception", { type, id, err: String(err) });
    } catch (e) {}
    return { statusCode: 500, body: String(err) };
  }
};
