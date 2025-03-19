'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface RoomInspection {
  id: string;
  roomId: string;
  room: {
    id: string;
    name: string;
    description: string | null;
  };
  status: string;
  taskResultsCount: number;
  completedTasksCount: number;
  photosCount: number;
}

interface Inspection {
  id: string;
  propertyName: string;
  status: string;
  createdAt: string;
  roomInspections: RoomInspection[];
}

export default function InspectionDetailPage({ params }: { params: { id: string } }) {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [authStatus, router]);

  useEffect(() => {
    async function fetchInspection() {
      try {
        const response = await fetch(`/api/inspections/${params.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch inspection');
        }
        const data = await response.json();
        setInspection(data);
      } catch (error) {
        console.error('Error fetching inspection:', error);
        toast.error('Failed to load inspection');
      } finally {
        setLoading(false);
      }
    }

    if (authStatus === 'authenticated') {
      fetchInspection();
    }
  }, [params.id, authStatus]);

  const completeInspection = async () => {
    try {
      // Check if all rooms are completed
      if (!inspection?.roomInspections.every(room => room.status === 'COMPLETED')) {
        toast.error('Please complete all room inspections first');
        return;
      }

      const response = await fetch(`/api/inspections/${params.id}/complete`, {
        method: 'PUT',
      });

      if (!response.ok) {
        throw new Error('Failed to complete inspection');
      }

      toast.success('Inspection marked as completed');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error completing inspection:', error);
      toast.error('Failed to complete inspection');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="spinner w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading inspection...</p>
        </div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-semibold text-gray-900">Inspection not found</h2>
        <p className="mt-2 text-gray-600">The requested inspection could not be found.</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Calculate completion status
  const totalRooms = inspection.roomInspections.length;
  const completedRooms = inspection.roomInspections.filter(room => room.status === 'COMPLETED').length;
  const completionPercentage = totalRooms > 0 ? Math.round((completedRooms / totalRooms) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard')}
          className="inline-flex items-center text-sm text-gray-600 hover:text-pink-600"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Dashboard
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{inspection.propertyName}</h1>
            <p className="text-gray-500">
              Created on {new Date(inspection.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              inspection.status === 'COMPLETED' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {inspection.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-medium">Completion Progress</h2>
            <span className="text-sm font-medium">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-pink-600 h-2.5 rounded-full"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Rooms to Inspect</h2>
        <div className="space-y-4">
          {inspection.roomInspections.map((roomInspection) => (
            <div 
              key={roomInspection.id}
              className="border rounded-lg p-4 hover:border-pink-300 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium">{roomInspection.room.name}</h3>
                  {roomInspection.room.description && (
                    <p className="text-sm text-gray-500">{roomInspection.room.description}</p>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-gray-500">
                    {roomInspection.completedTasksCount}/{roomInspection.taskResultsCount} tasks
                    {roomInspection.photosCount > 0 && (
                      <span className="ml-2">| {roomInspection.photosCount} photos</span>
                    )}
                  </div>
                  <span className={`inline-block w-3 h-3 rounded-full ${
                    roomInspection.status === 'COMPLETED' 
                      ? 'bg-green-500' 
                      : 'bg-yellow-500'
                  }`}></span>
                </div>
              </div>
              
              <div className="mt-3 flex justify-end">
                <Link 
                  href={`/inspections/${params.id}/rooms/${roomInspection.roomId}`}
                  className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium ${
                    roomInspection.status === 'COMPLETED'
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                  }`}
                >
                  {roomInspection.status === 'COMPLETED' ? 'View' : 'Inspect'}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {inspection.status !== 'COMPLETED' && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={completeInspection}
              disabled={completedRooms < totalRooms}
              className="inline-flex justify-center rounded-md border border-transparent bg-pink-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Complete Inspection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}