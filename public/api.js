// api.js
const API_BASE_URL = '/api';
const CACHE_EXPIRY = 60000; // 1 minute

export async function fetchTasks() {
    const cachedTasks = localStorage.getItem('cachedTasks');
    const cacheExpiry = localStorage.getItem('cachedTasksExpiry');
    const now = new Date().getTime();

    if (cachedTasks && cacheExpiry && now < cacheExpiry) {
        return JSON.parse(cachedTasks);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/load`);
        if (!response.ok) {
            throw new Error('Failed to fetch tasks');
        }
        const tasks = await response.json();
        localStorage.setItem('cachedTasks', JSON.stringify(tasks));
        localStorage.setItem('cachedTasksExpiry', now + CACHE_EXPIRY);
        return tasks;
    } catch (error) {
        console.error('Error fetching tasks:', error);
        throw error;
    }
}

export async function saveTasks(tasks) {
    try {
        const response = await fetch(`${API_BASE_URL}/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tasks),
        });
        if (!response.ok) {
            throw new Error('Failed to save tasks');
        }
        return await response.json();
    } catch (error) {
        console.error('Error saving tasks:', error);
        throw error;
    }
}

export async function uploadPhoto(formData) {
    try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            throw new Error('Failed to upload photo');
        }
        return await response.json();
    } catch (error) {
        console.error('Error uploading photo:', error);
        throw error;
    }
}