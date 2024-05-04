document.addEventListener('DOMContentLoaded', function() {
    const roomListElement = document.getElementById('roomList');
    const detailContainer = document.getElementById('detailContainer');
    const rooms = [
        { name: 'Backyard', itemCount: 3 },
        { name: 'Bathroom 1', itemCount: 3 },
        { name: 'Bedroom 1', itemCount: 3 },
        { name: 'Entrance', itemCount: 3 },
        { name: 'General', itemCount: 5 },
        { name: 'Kitchen', itemCount: 5 },
        { name: 'Living Room', itemCount: 3 },
        { name: 'Washer/Dryer', itemCount: 2 }
    ];

    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.className = 'room';
        roomElement.innerHTML = `
            <span class="room-name">${room.name}</span>
            <span class="item-count">0/${room.itemCount} items</span>
            <span class="arrow">&gt;</span>
        `;
        roomElement.addEventListener('click', () => loadRoomDetails(room, detailContainer));
        roomListElement.appendChild(roomElement);
    });

    setupPhotoUploads();
    loadTaskState();
});

function generateUniqueID(prefix) {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

function loadRoomDetails(room, container) {
    const uniquePhotoId1 = generateUniqueID('photo1');
    const uniquePhotoId2 = generateUniqueID('photo2');

    const tasks = {
        'Backyard': ['Clean patio', 'Arrange chairs', 'Sweep leaves'],
        'Bathroom 1': ['Scrub tiles', 'Clean sink', 'Refill soaps'],
        'Bedroom 1': ['Make beds', 'Vacuum carpet', 'Dust shelves'],
        'Entrance': ['Clean door', 'Polish doorknob', 'Sweep floor'],
        'General': ['Check lights', 'Test smoke alarms', 'Arrange magazines', 'Empty Ice Tray', 'Remove Garbage'],
        'Kitchen': ['Check drawers', 'All Surfaces wiped and clear', 'Inside fridge, microwave, oven etc. clean'],
        'Living Room': ['All lights are functional', 'Pillows on couches are straightened', 'carpets are vacuumed'],
        'Washer/Dryer': ['Clean lint trap', 'Wipe surfaces', 'Check hoses']
    };

    let taskHtml = tasks[room.name].map(task => `
        <div class="task">
            <input type="checkbox" id="task-${task.replace(/\s+/g, '-')}" name="task">
            <label for="task-${task.replace(/\s+/g, '-')}"">${task}</label>
        </div>
    `).join('');

    container.innerHTML = `
        <h2>${room.name}</h2>
        <div class="tasks">${taskHtml}</div>
        <div class="photos">
            <div class="photo-upload">
                <label for="${uniquePhotoId1}">Add Photo:</label>
                <input type="file" id="${uniquePhotoId1}" name="photo" accept="image/*">
            </div>
            <div class="photo-upload">
                <label for="${uniquePhotoId2}">Add Photo:</label>
                <input type="file" id="${uniquePhotoId2}" name="photo" accept="image/*">
            </div>
        </div>
        <button onclick="toggleDetail(false)">Return to List</button>
    `;
    toggleDetail(true);
    setupPhotoUploads();
}

function toggleDetail(show) {
    const detailContainer = document.getElementById('detailContainer');
    const roomList = document.getElementById('roomList');
    if (show) {
        detailContainer.classList.add('visible');
        detailContainer.classList.remove('hidden');
        roomList.classList.add('hidden');
        roomList.classList.remove('visible');
    } else {
        detailContainer.classList.add('hidden');
        detailContainer.classList.remove('visible');
        roomList.classList.add('visible');
        roomList.classList.remove('hidden');
    }
}

function setupPhotoUploads() {
    const photoInputs = document.querySelectorAll('.photo-upload input[type="file"]');
    photoInputs.forEach(input => {
        input.removeEventListener('change', handleFileChange);
        input.addEventListener('change', handleFileChange);
    });
}

function handleFileChange(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 10485760) { // 10 MB limit
            alert('File is too large. Please upload a file smaller than 10MB.');
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => alert('Failed to read file!');
        reader.onload = function(e) {
            const photoContainer = event.target.parentElement;
            let img = photoContainer.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                photoContainer.appendChild(img);
            }
            img.src = e.target.result;
            img.classList.add('uploaded-photo');
        };
        reader.readAsDataURL(file);
    }
}

document.addEventListener('change', function(event) {
    if (event.target.matches('.tasks input[type="checkbox"]')) {
        saveTaskState();
    }
});

function saveTaskState() {
    const state = {};
    document.querySelectorAll('.tasks input[type="checkbox"]').forEach((checkbox, index) => {
        state[index] = checkbox.checked;
    });
    localStorage.setItem('taskState', JSON.stringify(state));
}

function loadTaskState() {
    const state = JSON.parse(localStorage.getItem('taskState'));
    if (state) {
        document.querySelectorAll('.tasks input[type="checkbox"]').forEach((checkbox, index) => {
            checkbox.checked = state[index] ?? false;
        });
    }
}

// Add CSS class for uploaded photos
