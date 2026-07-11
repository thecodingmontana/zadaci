import dns from "node:dns";

const origLookup = dns.lookup;

dns.lookup = ((hostname: unknown, options: unknown, callback: unknown) => {
  if (typeof options === "function") {
    callback = options;
    options = { family: 4 };
  } else if (typeof options === "number") {
    options = { family: 4 };
  } else if (typeof options === "object" && options !== null) {
    options = { ...options, family: 4 };
  }
  return origLookup(hostname, options, callback);
}) as typeof dns.lookup;

export default defineNitroPlugin(() => {});
