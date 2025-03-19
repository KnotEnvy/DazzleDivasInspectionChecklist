'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

interface Property {
  id: string;
  name: string;
  address: string;
}

export default function NewInspectionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [customPropertyName, setCustomPropertyName] = useState('');
  const [useCustomProperty, setUseCustomProperty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setIsLoading(false);
      }
    }

    if (status === 'authenticated') {
      fetchProperties();
    }
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (useCustomProperty && !customPropertyName.trim()) {
      toast.error('Please enter a property name');
      return;
    }
    
    if (!useCustomProperty && !selectedPropertyId) {
      toast.error('Please select a property');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const propertyName = useCustomProperty 
        ? customPropertyName.trim() 
        : properties.find(p => p.id === selectedPropertyId)?.name || '';
      
      const response = await fetch('/api/inspections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          propertyName,
          propertyId: useCustomProperty ? null : selectedPropertyId,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create inspection');
      }
      
      const data = await response.json();
      toast.success('Inspection created successfully');
      router.push(`/inspections/${data.id}`);
    } catch (error) {
      console.error('Error creating inspection:', error);
      toast.error('Failed to create inspection');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="spinner w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading properties...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">New Inspection</h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Property Information</h2>
              <div className="flex items-center">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomProperty}
                    onChange={() => setUseCustomProperty(!useCustomProperty)}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    Custom Property
                  </span>
                </label>
              </div>
            </div>
            
            {useCustomProperty ? (
              <div>
                <label htmlFor="customPropertyName" className="block text-sm font-medium text-gray-700 mb-2">
                  Property Name
                </label>
                <input
                  type="text"
                  id="customPropertyName"
                  value={customPropertyName}
                  onChange={(e) => setCustomPropertyName(e.target.value)}
                  placeholder="Enter property name or address"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 sm:text-sm"
                  required
                />
              </div>
            ) : (
              <div>
                <label htmlFor="propertyId" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Property
                </label>
                {properties.length === 0 ? (
                  <div className="p-4 bg-yellow-50 rounded-md">
                    <p className="text-sm text-yellow-700">
                      No properties are assigned to you yet. Please contact an administrator or use the custom property option.
                    </p>
                  </div>
                ) : (
                  <select
                    id="propertyId"
                    value={selectedPropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 sm:text-sm"
                    required
                  >
                    <option value="">Select a property</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name} - {property.address}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
          
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="mx-2 inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!useCustomProperty && properties.length === 0)}
              className="inline-flex justify-center rounded-md border border-transparent bg-pink-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Inspection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}