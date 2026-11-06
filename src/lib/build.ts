declare const __BUILD__: string;

/** This build's id (the commit on Vercel): the same in the browser code and /api/version. */
export const BUILD: string = typeof __BUILD__ === "string" ? __BUILD__ : "dev";
