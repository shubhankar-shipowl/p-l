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
      // Create users table if it doesn't exist
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255) UNIQUE NOT NULL,
          emailVerified DATETIME,
          password VARCHAR(255) NOT NULL,
          image VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_email (email)
        )
      `);

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
      { error: "Failed to setup/add user", details: error.message },
      { status: 500 }
    );
  }
}

