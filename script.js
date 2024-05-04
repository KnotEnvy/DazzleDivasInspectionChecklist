document.addEventListener('DOMContentLoaded', function() {
    const roomListElement = document.getElementById('roomList');
    const detailContainer = document.getElementById('detailContainer');
    const rooms = [
        { name: 'Backyard', itemCount: 3 },
        { name: 'Bathroom 1', itemCount: 3 },
        { name: 'Bedroom 1', itemCount: 3 },
        { name: 'Entrance', itemCount: 3 },
        { name: 'General', itemCount: 3 },
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

function loadRoomDetails(room, container) {
    const tasks = {
        'Backyard': ['Clean patio', 'Arrange chairs', 'Sweep leaves'],
        'Bathroom 1': ['Scrub tiles', 'Clean sink', 'Refill soaps'],
        'Bedroom 1': ['Make beds', 'Vacuum carpet', 'Dust shelves'],
        'Entrance': ['Clean door', 'Polish doorknob', 'Sweep floor'],
        'General': ['Check lights', 'Set A/C to 78', 'Check supplies closet'],
        'Kitchen': ['Check drawers', 'All Surfaces wiped and clear', 'Inside fridge, microwave, oven etc. clean','Empty Ice Tray', 'Remove Garbage' ],
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
                <label for="photo1">Add Photo:</label>
                <input type="file" id="photo1" name="photo1" accept="image/*">
            </div>
            <div class="photo-upload">
                <label for="photo2">Add Photo:</label>
                <input type="file" id="photo2" name="photo2" accept="image/*">
            </div>
        </div>
        <button onclick="toggleDetail(false)">Return to List</button>
    `;
    toggleDetail(true);
    setupPhotoUploads();
}

function toggleDetail(show) {
    document.getElementById('detailContainer').style.display = show ? 'block' : 'none';
    document.getElementById('roomList').style.display = show ? 'none' : 'block';
}

function setupPhotoUploads() {
    const photoInputs = document.querySelectorAll('.photo-upload input[type="file"]');
    photoInputs.forEach(input => {
        input.addEventListener('change', function() {
            const file = input.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {``
                    const photoContainer = input.parentElement;
                    let img = photoContainer.querySelector('img');
                    if (!img) {
                        img = document.createElement('img');
                        photoContainer.appendChild(img);
                    }
                    img.src = e.target.result;
                    img.style.maxWidth = '100px';
                    img.style.marginTop = '10px';
                };
                reader.readAsDataURL(file);
            }
        });
    });
}

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
