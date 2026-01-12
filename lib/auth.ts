import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import pool from "./db";
import bcrypt from "bcryptjs";

// Validate NEXTAUTH_SECRET is set
if (!process.env.NEXTAUTH_SECRET) {
  console.error("❌ NEXTAUTH_SECRET is not set in environment variables!");
  console.error("   Please add NEXTAUTH_SECRET to your .env.local file");
  console.error("   Generate one with: openssl rand -base64 32");
  throw new Error("NEXTAUTH_SECRET is required but not set");
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        let connection;
        try {
          connection = await pool.getConnection();
          const [rows] = await connection.query(
            "SELECT * FROM users WHERE email = ?",
            [credentials.email]
          );

          const user = (rows as any[])[0];
          if (!user) {
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name,
            image: user.image,
          };
        } catch (error: any) {
          console.error("Auth error:", error.message);
          // Return null on error to prevent revealing database issues
          return null;
        } finally {
          if (connection) {
            connection.release();
          }
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

