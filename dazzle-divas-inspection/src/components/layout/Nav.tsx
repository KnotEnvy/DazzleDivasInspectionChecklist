'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

export default function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => {
    return pathname === path ? 'text-pink-600 font-bold' : 'text-gray-600 hover:text-pink-500';
  };

  const isAdmin = session?.user?.role === 'ADMIN';

  // Handle scroll events to make the header sticky with shadow
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent scrolling when menu is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // Close menu when changing routes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  return (
    <nav className={`bg-white ${scrolled ? 'shadow-md' : ''} sticky top-0 z-30 transition-shadow duration-300`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <span className="text-xl font-bold text-pink-600">Dazzle Divas</span>
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
                    Dashboard
                  </Link>
                  <Link href="/inspections/new" className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/inspections/new')}`}>
                    New Inspection
                  </Link>
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
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-pink-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-pink-500"
              aria-expanded={isMenuOpen}
            >
              <span className="sr-only">{isMenuOpen ? 'Close menu' : 'Open menu'}</span>
              <svg 
                className="h-6 w-6" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                aria-hidden="true"
              >
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
      
      {/* Mobile menu overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 md:hidden transition-opacity duration-300">
          <div 
            ref={menuRef}
            className="fixed inset-y-0 right-0 max-w-xs w-full bg-white shadow-xl flex flex-col transform transition-transform duration-300"
          >
            <div className="flex items-center justify-between px-4 py-5 border-b border-gray-200">
              <div className="text-lg font-medium text-pink-600">Menu</div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <span className="sr-only">Close panel</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 py-4 overflow-y-auto">
              <div className="px-2 space-y-1">
                <Link
                  href="/"
                  className={`block px-3 py-4 rounded-md text-base font-medium ${isActive('/')} border-b border-gray-100`}
                >
                  Home
                </Link>
                
                {status === 'authenticated' && (
                  <>
                    <Link
                      href="/dashboard"
                      className={`block px-3 py-4 rounded-md text-base font-medium ${isActive('/dashboard')} border-b border-gray-100`}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/inspections/new"
                      className={`block px-3 py-4 rounded-md text-base font-medium ${isActive('/inspections/new')} border-b border-gray-100`}
                    >
                      New Inspection
                    </Link>
                    <Link
                      href="/history"
                      className={`block px-3 py-4 rounded-md text-base font-medium ${isActive('/history')} border-b border-gray-100`}
                    >
                      History
                    </Link>
                    
                    {isAdmin && (
                      <>
                        <Link
                          href="/properties"
                          className={`block px-3 py-4 rounded-md text-base font-medium ${isActive('/properties')} border-b border-gray-100`}
                        >
                          Properties
                        </Link>
                        <Link
                          href="/admin"
                          className={`block px-3 py-4 rounded-md text-base font-medium ${isActive('/admin')} border-b border-gray-100`}
                        >
                          Admin
                        </Link>
                      </>
                    )}
                  </>
                )}
                
                {status === 'unauthenticated' ? (
                  <Link
                    href="/login"
                    className="block px-3 py-4 text-center rounded-md text-base font-medium text-white bg-pink-600 hover:bg-pink-700 mt-4"
                  >
                    Sign In
                  </Link>
                ) : (
                  <button
                    onClick={() => signOut()}
                    className="w-full px-3 py-4 mt-4 text-center rounded-md text-base font-medium text-white bg-pink-600 hover:bg-pink-700"
                  >
                    Sign Out
                  </button>
                )}
              </div>
            </div>
            
            {status === 'authenticated' && (
              <div className="border-t border-gray-200 p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center">
                      <span className="text-pink-700 font-medium text-sm">
                        {session.user?.name?.substring(0, 1).toUpperCase() || 'U'}
                      </span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800 truncate max-w-[180px]">
                      {session.user?.name}
                    </div>
                    <div className="text-sm font-medium text-gray-500 truncate max-w-[180px]">
                      {session.user?.email}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}