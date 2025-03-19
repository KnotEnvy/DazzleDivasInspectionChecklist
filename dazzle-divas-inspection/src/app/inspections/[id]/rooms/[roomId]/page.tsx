'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface Task {
  id: string;
  description: string;
  completed: boolean;
}

interface Room {
  id: string;
  name: string;
  description?: string;
}

interface Photo {
  id?: string;
  url?: string;
  file?: File;
}

interface RoomInspectionData {
  id: string;
  room: Room;
  tasks: Task[];
  photos: Photo[];
  status: string;
}

export default function RoomInspectionPage({
  params,
}: {
  params: { id: string; roomId: string };
}) {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roomInspection, setRoomInspection] = useState<RoomInspectionData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const fetchRoomInspection = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/inspections/${params.id}/rooms/${params.roomId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch room inspection data');
      }
      
      const data = await response.json();
      setRoomInspection(data);
      setTasks(data.tasks || []);
      setPhotos(data.photos || []);
    } catch (error) {
      console.error('Error fetching room inspection:', error);
      toast.error('Failed to load room inspection data');
    } finally {
      setLoading(false);
    }
  }, [params.id, params.roomId]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login');
    } else if (authStatus === 'authenticated') {
      fetchRoomInspection();
    }
  }, [authStatus, router, fetchRoomInspection]);

  const handleTaskChange = (taskId: string, completed: boolean) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, completed } : task
    ));
  };

  const handlePhotoUpload = (index: number, file: File) => {
    // Create object URL for preview
    const url = URL.createObjectURL(file);
    
    const newPhotos = [...photos];
    newPhotos[index] = { file, url };
    setPhotos(newPhotos);
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = [...photos];
    if (newPhotos[index] && newPhotos[index].url && !newPhotos[index].file) {
      // If it's an existing photo from the server, mark it for deletion
      newPhotos[index] = { id: newPhotos[index].id, url: '', delete: true };
    } else {
      // If it's a new photo that hasn't been uploaded yet
      newPhotos[index] = {};
      if (fileInputRefs[index].current) {
        fileInputRefs[index].current.value = '';
      }
    }
    setPhotos(newPhotos);
  };

  const saveInspection = async () => {
    setSaving(true);
    
    try {
      // First, save the task results
      await fetch(`/api/inspections/${params.id}/rooms/${params.roomId}/tasks`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tasks }),
      });
      
      // Then, handle the photos - upload new ones and delete marked ones
      if (photos.some(p => p.file || p.delete)) {
        const formData = new FormData();
        
        photos.forEach((photo, index) => {
          if (photo.file) {
            formData.append(`photos`, photo.file);
            formData.append(`photoIndices`, index.toString());
          }
          
          if (photo.delete && photo.id) {
            formData.append(`deletePhotoIds`, photo.id);
          }
        });
        
        await fetch(`/api/inspections/${params.id}/rooms/${params.roomId}/photos`, {
          method: 'POST',
          body: formData,
        });
      }
      
      toast.success('Inspection saved successfully');
      fetchRoomInspection(); // Refresh data
    } catch (error) {
      console.error('Error saving inspection:', error);
      toast.error('Failed to save inspection');
    } finally {
      setSaving(false);
    }
  };

  const completeInspection = async () => {
    // Check if all tasks are completed
    if (!tasks.every(task => task.completed)) {
      toast.error('Please complete all tasks before proceeding');
      return;
    }
    
    // Check if there are at least 2 photos
    if (photos.filter(p => p.url && !p.delete).length < 2) {
      toast.error('Please upload at least 2 photos');
      return;
    }
    
    setSaving(true);
    
    try {
      // Save current changes first
      await saveInspection();
      
      // Mark room inspection as completed
      await fetch(`/api/inspections/${params.id}/rooms/${params.roomId}/complete`, {
        method: 'PUT',
      });
      
      toast.success('Room inspection completed');
      router.push(`/inspections/${params.id}`);
    } catch (error) {
      console.error('Error completing inspection:', error);
      toast.error('Failed to complete inspection');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="spinner w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading room inspection...</p>
        </div>
      </div>
    );
  }

  if (!roomInspection) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-semibold text-gray-900">Room not found</h2>
        <p className="mt-2 text-gray-600">The requested room inspection could not be found.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push(`/inspections/${params.id}`)}
          className="inline-flex items-center text-sm text-gray-600 hover:text-pink-600"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Rooms
        </button>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{roomInspection.room.name}</h1>
        {roomInspection.room.description && (
          <p className="text-gray-600 mb-4">{roomInspection.room.description}</p>
        )}
        
        {roomInspection.status === 'COMPLETED' ? (
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-md mb-6">
            This room inspection has been completed.
          </div>
        ) : (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Step 1: Verify all tasks</h2>
            <div className="space-y-3 mb-8">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-start">
                  <input
                    type="checkbox"
                    id={`task-${task.id}`}
                    checked={task.completed}
                    onChange={(e) => handleTaskChange(task.id, e.target.checked)}
                    className="mt-1 h-4 w-4 text-pink-600 focus:ring-pink-500 rounded"
                    disabled={roomInspection.status === 'COMPLETED'}
                  />
                  <label htmlFor={`task-${task.id}`} className="ml-3 text-sm text-gray-700">
                    {task.description}
                  </label>
                </div>
              ))}
            </div>
            
            <h2 className="text-xl font-semibold mb-4">Step 2: Upload photos (2 required)</h2>
            <div className="grid grid-cols-2 gap-6 mb-8">
              {[0, 1].map((index) => (
                <div key={index} className="flex flex-col items-center">
                  <div 
                    className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg flex justify-center items-center relative"
                    style={{ background: photos[index]?.url ? '#f3f4f6' : 'white' }}
                  >
                    {photos[index]?.url && !photos[index]?.delete ? (
                      <>
                        <Image 
                          src={photos[index].url as string} 
                          alt={`Photo ${index + 1}`} 
                          fill
                          style={{ objectFit: 'contain' }}
                          className="p-2"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute top-2 right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200"
                          disabled={roomInspection.status === 'COMPLETED'}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <input
                          type="file"
                          ref={fileInputRefs[index]}
                          id={`photo-${index}`}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handlePhotoUpload(index, e.target.files[0]);
                            }
                          }}
                          disabled={roomInspection.status === 'COMPLETED'}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRefs[index].current?.click()}
                          className="bg-gray-100 text-gray-600 rounded-md px-4 py-2 hover:bg-gray-200"
                          disabled={roomInspection.status === 'COMPLETED'}
                        >
                          Upload Photo {index + 1}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={saveInspection}
                disabled={saving || roomInspection.status === 'COMPLETED'}
                className="inline-flex justify-center rounded-md border border-transparent bg-gray-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Progress'}
              </button>
              <button
                type="button"
                onClick={completeInspection}
                disabled={saving || roomInspection.status === 'COMPLETED'}
                className="inline-flex justify-center rounded-md border border-transparent bg-pink-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {saving ? 'Processing...' : 'Mark Complete & Continue'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}