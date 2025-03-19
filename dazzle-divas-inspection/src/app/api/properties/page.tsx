'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Property {
  id: string;
  name: string;
  address: string;
  description: string | null;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  isActive: boolean;
  createdAt: string;
}

export default function PropertiesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchProperties() {
      try {
        const response = await fetch('/api/properties');
        if (!response.ok) {
          throw new Error('Failed to fetch properties');
        }
        const data = await response.json();
        setProperties(data);
      } catch (error) {
        console.error('Error fetching properties:', error);
        toast.error('Failed to load properties');
      } finally {
        setLoading(false);
      }
    }

    if (status === 'authenticated') {
      fetchProperties();
    }
  }, [status]);

  // Check if user is admin
  const isAdmin = session?.user?.role === 'ADMIN';

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="spinner w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading properties...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-yellow-50 p-4 rounded-md">
          <p className="text-yellow-700">
            You don't have permission to access this page. This page is only available to administrators.
          </p>
          <Link href="/dashboard" className="mt-2 inline-block text-pink-600 hover:text-pink-800">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Properties Management</h1>
        <Link 
          href="/properties/new" 
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
        >
          Add New Property
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center p-8 border border-dashed border-gray-300 rounded-md">
            <p className="text-gray-500">No properties found. Add your first property to get started.</p>
            <Link 
              href="/properties/new" 
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none"
            >
              Add Property
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Property
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {properties.map((property) => (
                <tr key={property.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{property.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500">{property.address}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      property.propertyType === 'RESIDENTIAL' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {property.propertyType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {property.propertyType === 'RESIDENTIAL' && (
                      <div className="text-sm text-gray-500">
                        {property.bedrooms} BR / {property.bathrooms} BA
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      property.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {property.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link 
                      href={`/properties/${property.id}`} 
                      className="text-pink-600 hover:text-pink-900 mr-4"
                    >
                      View
                    </Link>
                    <Link 
                      href={`/properties/${property.id}/edit`} 
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      Edit
                    </Link>
                    <Link 
                      href={`/properties/${property.id}/assign`} 
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Assign
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}