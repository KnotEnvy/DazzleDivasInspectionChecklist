'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Inspector {
  id: string;
  name: string;
  email: string;
  isAssigned?: boolean;
  assignmentId?: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
}

export default function AssignPropertyPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Check if user is authenticated and is an admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      toast.error('You do not have permission to access this page');
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Fetch property and inspectors data
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch property details
        const propertyResponse = await fetch(`/api/properties/${params.id}`);
        if (!propertyResponse.ok) {
          throw new Error('Failed to fetch property');
        }
        const propertyData = await propertyResponse.json();
        setProperty(propertyData);

        // Fetch all inspectors
        const inspectorsResponse = await fetch('/api/users?role=INSPECTOR');
        if (!inspectorsResponse.ok) {
          throw new Error('Failed to fetch inspectors');
        }
        const inspectorsData = await inspectorsResponse.json();

        // Mark inspectors who are already assigned
        const enhancedInspectors = inspectorsData.map((inspector: Inspector) => {
          const assignment = propertyData.assignments.find(
            (a: any) => a.inspector.id === inspector.id
          );
          return {
            ...inspector,
            isAssigned: !!assignment,
            assignmentId: assignment?.id || undefined,
          };
        });

        setInspectors(enhancedInspectors);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      fetchData();
    }
  }, [params.id, status, session]);

  const toggleInspectorAssignment = async (inspectorId: string, isCurrentlyAssigned: boolean) => {
    setSaving(true);

    try {
      const url = `/api/properties/${params.id}/assign`;
      const method = isCurrentlyAssigned ? 'DELETE' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          inspectorId,
          // If we're removing an assignment, include the assignment ID
          assignmentId: isCurrentlyAssigned ? 
            inspectors.find(i => i.id === inspectorId)?.assignmentId : 
            undefined
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${isCurrentlyAssigned ? 'remove' : 'assign'} inspector`);
      }

      // Update local state
      setInspectors(inspectors.map(inspector => {
        if (inspector.id === inspectorId) {
          return {
            ...inspector,
            isAssigned: !isCurrentlyAssigned,
            assignmentId: isCurrentlyAssigned ? undefined : inspector.assignmentId,
          };
        }
        return inspector;
      }));

      toast.success(
        isCurrentlyAssigned 
          ? 'Inspector removed from property' 
          : 'Inspector assigned to property'
      );
    } catch (error) {
      console.error('Error toggling assignment:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update assignment');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="spinner w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-semibold text-gray-900">Property not found</h2>
        <p className="mt-2 text-gray-600">The requested property could not be found.</p>
        <button
          onClick={() => router.push('/properties')}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700"
        >
          Return to Properties
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/properties/${params.id}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-pink-600"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Property Details
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Manage Inspector Assignments</h1>
        <p className="text-gray-600 mb-6">
          {property.name} - {property.address}
        </p>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Assigned inspectors will be able to create and perform inspections for this property.
              </p>
            </div>
          </div>
        </div>

        {inspectors.length === 0 ? (
          <div className="text-center p-8 border border-dashed border-gray-300 rounded-md">
            <p className="text-gray-500">No inspectors available. Add inspectors to your system first.</p>
            <Link 
              href="/admin/users" 
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700"
            >
              Manage Users
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Email
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {inspectors.map((inspector) => (
                  <tr key={inspector.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                      {inspector.name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {inspector.email}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        inspector.isAssigned ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {inspector.isAssigned ? 'Assigned' : 'Not Assigned'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <button
                        onClick={() => toggleInspectorAssignment(inspector.id, inspector.isAssigned || false)}
                        disabled={saving}
                        className={`${
                          inspector.isAssigned 
                            ? 'text-red-600 hover:text-red-900' 
                            : 'text-green-600 hover:text-green-900'
                        }`}
                      >
                        {inspector.isAssigned ? 'Remove' : 'Assign'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}