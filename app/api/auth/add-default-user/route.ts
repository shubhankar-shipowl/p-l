import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const email = "finance@shipowl.io";
    const password = "Shipowl@6";
    const name = "Finance User";

    const connection = await pool.getConnection();
    try {
      // Check if user already exists
      const [existingUsers] = await connection.query(
        "SELECT id, email FROM users WHERE email = ?",
        [email]
      ) as any[];

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      if (existingUsers.length > 0) {
        // Update existing user
        await connection.query(
          "UPDATE users SET password = ?, name = ? WHERE email = ?",
          [hashedPassword, name, email]
        );

        return NextResponse.json({
          message: "User password updated successfully",
          email,
        });
      } else {
        // Create new user
        await connection.query(
          "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
          [name, email, hashedPassword]
        );

        return NextResponse.json({
          message: "User created successfully",
          email,
        });
      }
    } finally {
      connection.release();
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to add user",
        details: error.message,
        code: error.code,
      },
      { status: 500 }
    );
  }
}

