// Builds public/sw.js after `next build` (npm run build). Serwist's Next plugin
// needs webpack, so with Turbopack we use the CLI instead.
import { serwist } from "@serwist/next/config";

export default serwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});
