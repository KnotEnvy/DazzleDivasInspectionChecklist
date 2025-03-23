'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';

interface Task {
  id: string;
  description: string;
  completed: boolean;
}

interface Photo {
  id: string;
  url: string;
  fileName: string;
}

interface RoomInspection {
  id: string;
  status: string;
  notes: string | null;
  room: {
    id: string;
    name: string;
    description: string | null;
  };
  taskResults: {
    id: string;
    completed: boolean;
    task: Task;
  }[];
  photos: Photo[];
}

interface Inspection {
  id: string;
  propertyName: string;
  propertyId: string | null;
  property: {
    id: string | null;
    name: string | null;
    address: string | null;
    propertyType: string | null;
  } | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  inspector: {
    id: string;
    name: string;
    email: string;
  };
  roomInspections: RoomInspection[];
}

export default function InspectionReportPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxPhotos, setLightboxPhotos] = useState<Photo[]>([]);
  
  // Check if user is authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch inspection data
  useEffect(() => {
    async function fetchInspection() {
      try {
        setLoading(true);
        const response = await fetch(`/api/history/${params.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch inspection');
        }
        
        const data = await response.json();
        setInspection(data);
        
        // Set first room as active by default if there are rooms
        if (data.roomInspections && data.roomInspections.length > 0) {
          setActiveRoomId(data.roomInspections[0].id);
        }
      } catch (error) {
        console.error('Error fetching inspection:', error);
        toast.error('Failed to load inspection data');
      } finally {
        setLoading(false);
      }
    }

    if (status === 'authenticated') {
      fetchInspection();
    }
  }, [params.id, status]);

  const handleExport = async (format: 'pdf' | 'csv' | 'excel') => {
    try {
      setExportLoading(true);
      
      // Request single inspection export
      const response = await fetch(`/api/history/${params.id}/export?format=${format}`);
      
      if (!response.ok) {
        throw new Error('Failed to export inspection');
      }
      
      // Handle the file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Set filename based on format
      let filename = `inspection_report_${inspection?.propertyName || ''}_${new Date().toISOString().split('T')[0]}`;
      if (format === 'pdf') filename += '.pdf';
      else if (format === 'csv') filename += '.csv';
      else if (format === 'excel') filename += '.xlsx';
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Exported successfully to ${format.toUpperCase()}`);
    } catch (error) {
      console.error(`Error exporting to ${format}:`, error);
      toast.error(`Failed to export to ${format}`);
    } finally {
      setExportLoading(false);
    }
  };

  const getCompletionPercentage = () => {
    if (!inspection) return 0;
    
    const totalRooms = inspection.roomInspections.length;
    const completedRooms = inspection.roomInspections.filter(
      room => room.status === 'COMPLETED'
    ).length;
    
    return totalRooms > 0 ? Math.round((completedRooms / totalRooms) * 100) : 0;
  };

  const getTaskCompletionPercentage = () => {
    if (!inspection) return 0;
    
    let totalTasks = 0;
    let completedTasks = 0;
    
    inspection.roomInspections.forEach(room => {
      totalTasks += room.taskResults.length;
      completedTasks += room.taskResults.filter(task => task.completed).length;
    });
    
    return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  };

  const openLightbox = (photos: Photo[], index: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="spinner w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading inspection report...</p>
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
          onClick={() => router.push('/history')}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700"
        >
          Return to History
        </button>
      </div>
    );
  }

  // Get active room
  const activeRoom = activeRoomId
    ? inspection.roomInspections.find(room => room.id === activeRoomId)
    : null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/history"
          className="inline-flex items-center text-sm text-gray-600 hover:text-pink-600"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to History
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inspection Report</h1>
        
        <div className="flex space-x-2">
          <button
            onClick={() => handleExport('pdf')}
            disabled={exportLoading}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50"
          >
            {exportLoading ? 'Exporting...' : 'Export PDF'}
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={exportLoading}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {exportLoading ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Inspection Summary Card */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{inspection.propertyName}</h2>
            <p className="text-gray-600">
              {inspection.property?.address || 'No address available'}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            inspection.status === 'COMPLETED' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {inspection.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Inspector</h3>
            <p className="mt-1 text-sm text-gray-900">{inspection.inspector.name}</p>
            <p className="text-sm text-gray-500">{inspection.inspector.email}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Date</h3>
            <p className="mt-1 text-sm text-gray-900">{formatDate(inspection.createdAt)}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Property Type</h3>
            <p className="mt-1 text-sm text-gray-900">
              {inspection.property?.propertyType || 'Not specified'}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Last Updated</h3>
            <p className="mt-1 text-sm text-gray-900">{formatDate(inspection.updatedAt)}</p>
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Completion Progress</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Rooms</span>
                <span className="text-sm font-medium text-gray-900">
                  {inspection.roomInspections.filter(room => room.status === 'COMPLETED').length}/{inspection.roomInspections.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-pink-600 h-2.5 rounded-full"
                  style={{ width: `${getCompletionPercentage()}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Tasks</span>
                <span className="text-sm font-medium text-gray-900">{getTaskCompletionPercentage()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full"
                  style={{ width: `${getTaskCompletionPercentage()}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Room Navigation and Details */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Room Navigation Sidebar */}
        <div className="md:col-span-1">
          <div className="bg-white shadow rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-4">Rooms</h3>
            <nav className="space-y-1">
              {inspection.roomInspections.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setActiveRoomId(room.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeRoomId === room.id
                      ? 'bg-pink-50 text-pink-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate">{room.room.name}</span>
                  <span className={`ml-auto inline-block w-2 h-2 rounded-full ${
                    room.status === 'COMPLETED' ? 'bg-green-500' : 'bg-yellow-500'
                  }`}></span>
                </button>
              ))}
            </nav>
          </div>
        </div>
        
        {/* Room Details */}
        <div className="md:col-span-3">
          {activeRoom ? (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  {activeRoom.room.name}
                  <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    activeRoom.status === 'COMPLETED'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {activeRoom.status}
                  </span>
                </h2>
                {activeRoom.room.description && (
                  <p className="mt-1 text-sm text-gray-500">{activeRoom.room.description}</p>
                )}
              </div>
              
              {/* Tasks List */}
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Tasks</h3>
                
                {activeRoom.taskResults.length === 0 ? (
                  <p className="text-sm text-gray-500">No tasks assigned to this room.</p>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {activeRoom.taskResults.map((taskResult) => (
                      <li key={taskResult.id} className="py-3 flex items-start">
                        <span className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center ${
                          taskResult.completed ? 'bg-green-100 text-green-500' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {taskResult.completed ? (
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </span>
                        <span className="ml-3 text-sm text-gray-700">{taskResult.task.description}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {/* Notes */}
              {activeRoom.notes && (
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Notes</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{activeRoom.notes}</p>
                </div>
              )}
              
              {/* Photos */}
              <div className="px-6 py-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Photos</h3>
                
                {activeRoom.photos.length === 0 ? (
                  <p className="text-sm text-gray-500">No photos available for this room.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {activeRoom.photos.map((photo, index) => (
                      <div 
                        key={photo.id} 
                        className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                        onClick={() => openLightbox(activeRoom.photos, index)}
                      >
                        <Image
                          src={photo.url}
                          alt={`Photo ${index + 1}`}
                          fill
                          sizes="(max-width: 640px) 100vw, 300px"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <p className="text-gray-500">Select a room to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Photo Lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center" onClick={closeLightbox}>
          <div className="relative w-full h-full max-w-5xl max-h-[80vh] flex items-center justify-center">
            {lightboxPhotos.length > 0 && (
              <Image
                src={lightboxPhotos[lightboxIndex].url}
                alt={`Photo ${lightboxIndex + 1}`}
                fill
                className="object-contain p-4"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            
            {/* Navigation controls */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center space-x-4">
              <button
                className="bg-white bg-opacity-20 text-white rounded-full p-2 hover:bg-opacity-30"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prevIndex) => 
                    (prevIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length
                  );
                }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                </svg>
              </button>
              
              <div className="bg-white bg-opacity-20 text-white rounded-full px-4 py-2">
                {lightboxIndex + 1} / {lightboxPhotos.length}
              </div>
              
              <button
                className="bg-white bg-opacity-20 text-white rounded-full p-2 hover:bg-opacity-30"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prevIndex) => 
                    (prevIndex + 1) % lightboxPhotos.length
                  );
                }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </button>
            </div>
            
            {/* Close button */}
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300"
              onClick={closeLightbox}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}