import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const connection = await pool.getConnection();
    try {
      // Check if user already exists
      const [existingUsers] = await connection.query(
        "SELECT id FROM users WHERE email = ?",
        [email]
      ) as any[];

      if (existingUsers.length > 0) {
        // Update existing user
        await connection.query(
          "UPDATE users SET password = ?, name = ? WHERE email = ?",
          [hashedPassword, name || "User", email]
        );
        return NextResponse.json({
          message: "User password updated successfully",
          email,
        });
      } else {
        // Insert new user
        await connection.query(
          "INSERT INTO users (email, password, name) VALUES (?, ?, ?)",
          [email, hashedPassword, name || "User"]
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
      { error: "Failed to add user", details: error.message },
      { status: 500 }
    );
  }
}

