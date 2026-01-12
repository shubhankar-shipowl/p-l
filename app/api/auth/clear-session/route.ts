import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Helper endpoint to clear invalid sessions
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Clear NextAuth session cookies
    cookieStore.delete("next-auth.session-token");
    cookieStore.delete("__Secure-next-auth.session-token");
    cookieStore.delete("next-auth.csrf-token");
    cookieStore.delete("__Secure-next-auth.csrf-token");
    cookieStore.delete("next-auth.callback-url");
    cookieStore.delete("__Secure-next-auth.callback-url");

    return NextResponse.json({ 
      message: "Session cleared successfully",
      success: true 
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to clear session", details: error.message },
      { status: 500 }
    );
  }
}

