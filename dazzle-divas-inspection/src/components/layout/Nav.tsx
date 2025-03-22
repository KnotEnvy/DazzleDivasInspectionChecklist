'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';

export default function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return pathname === path ? 'text-pink-600 font-bold' : 'text-gray-600 hover:text-pink-500';
  };

  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold text-pink-600">Dazzle Divas Cleaning</span>
            </Link>
          </div>
          
          {/* Desktop menu */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-4">
              <Link href="/" className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/')}`}>
                Home
              </Link>
              
              {status === 'authenticated' && (
                <>
                  <Link href="/dashboard" className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/dashboard')}`}>
                    Inspection Dashboard
                  </Link>
                  {/* <Link href="/inspections/new" className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/inspections/new')}`}>
                    New Inspection
                  </Link> */}
                  <Link href="/history" className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/history')}`}>
                    History
                  </Link>
                  
                  {isAdmin && (
                    <>
                      <Link href="/properties" className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/properties')}`}>
                        Properties
                      </Link>
                      <Link href="/admin" className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/admin')}`}>
                        Admin
                      </Link>
                    </>
                  )}
                  
                  <button
                    onClick={() => signOut()}
                    className="ml-4 px-4 py-2 rounded-md text-sm font-medium text-white bg-pink-600 hover:bg-pink-700"
                  >
                    Sign Out
                  </button>
                </>
              )}
              
              {status === 'unauthenticated' && (
                <Link href="/login" className="ml-4 px-4 py-2 rounded-md text-sm font-medium text-white bg-pink-600 hover:bg-pink-700">
                  Sign In
                </Link>
              )}
            </div>
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-500 hover:text-pink-600 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link href="/" className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/')}`}>
              Home
            </Link>
            
            {status === 'authenticated' && (
              <>
                <Link href="/dashboard" className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/dashboard')}`}>
                  Dashboard
                </Link>
                <Link href="/inspections/new" className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/inspections/new')}`}>
                  New Inspection
                </Link>
                <Link href="/history" className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/history')}`}>
                  History
                </Link>
                
                {isAdmin && (
                  <>
                    <Link href="/properties" className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/properties')}`}>
                      Properties
                    </Link>
                    <Link href="/admin" className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/admin')}`}>
                      Admin
                    </Link>
                  </>
                )}
                
                <button
                  onClick={() => signOut()}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-white bg-pink-600 hover:bg-pink-700"
                >
                  Sign Out
                </button>
              </>
            )}
            
            {status === 'unauthenticated' && (
              <Link href="/login" className="block px-3 py-2 rounded-md text-base font-medium text-white bg-pink-600 hover:bg-pink-700">
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}