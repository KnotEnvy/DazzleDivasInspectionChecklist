export default function Footer() {
    return (
      <footer className="bg-gray-100 py-6">
        <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
          <p>© {new Date().getFullYear()} Dazzle Divas Cleaning. All rights reserved.</p>
        </div>
      </footer>
    );
  }