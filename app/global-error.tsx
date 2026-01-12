'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">Something went wrong!</h2>
            <p className="text-slate-600 mb-4">{error.message}</p>
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
