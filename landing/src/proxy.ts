import createMiddleware from "next-intl/middleware";
import {routing} from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Every page path; not the API, Next's own files or anything with an extension (games.json, images).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
