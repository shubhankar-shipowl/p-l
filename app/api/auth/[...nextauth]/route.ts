import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
// Import db module to trigger connection logging on server startup
import "@/lib/db";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

