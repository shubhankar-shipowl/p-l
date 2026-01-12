import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();
    try {
      // Check if user already exists
      const [existingUsers] = await connection.query(
        "SELECT id FROM users WHERE email = ?",
        [email]
      );

      if ((existingUsers as any[]).length > 0) {
        return NextResponse.json(
          { error: "User with this email already exists" },
          { status: 400 }
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const [result] = await connection.query(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name, email, hashedPassword]
      );

      return NextResponse.json({
        message: "User created successfully",
        userId: (result as any).insertId,
      });
    } catch (error: any) {
      if (error.code === "ER_DUP_ENTRY") {
        return NextResponse.json(
          { error: "User with this email already exists" },
          { status: 400 }
        );
      }
      throw error;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create user", details: error.message },
      { status: 500 }
    );
  }
}

