import './globals.css';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import UploadsInitializer from '@/components/UploadsInitializer';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Dazzle Divas Cleaning Inspection',
  description: 'Professional cleaning inspection app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <UploadsInitializer />
          <div className="min-h-screen flex flex-col">
            <Nav />
            <main className="flex-grow container mx-auto px-4 py-8">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}