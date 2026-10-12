/** Database ids are cuids; anything else is rejected before it reaches a query. */
export const isId = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9]{20,40}$/.test(v);
