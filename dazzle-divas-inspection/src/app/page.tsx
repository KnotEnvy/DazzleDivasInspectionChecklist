import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]">
      <div className="text-center max-w-3xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-pink-600 mb-6">
          Dazzle Divas Cleaning Inspection
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Streamline your cleaning inspections with our easy-to-use digital checklist.
        </p>
        <div className="space-y-4">
          <Link 
            href="/login" 
            className="inline-block bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}