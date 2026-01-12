export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import database module to trigger connection logging
    await import('./lib/db');
  }
}

