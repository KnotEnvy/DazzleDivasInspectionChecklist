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
        'Bathroom 1': ['Make sure cabinets, drawers, and trash cans are all clean and presentable', 
                       'Towel bar and shower curtain rods are secure and curtain/towels are free of mold or stains', 
                       'The toilet flushes and is clean and the hot water works'],
        'Bedroom 1': ['All appliances are operational – tvs, lights, lamps, fans, etc.', 
                      'All linens are free of stains and the beds are made', 
                      'All surfaces are clean, this includes floors, window sills, blinds, and ceiling fans'],
        'Entrance': ['Clean door', 'Polish doorknob', 'Sweep floor'],
        'General': ['Turn on/off AC or Heat depending on season', 
                    'Check the HVAC vents for mold or dust throughout the house', 
                    'Confirm that all windows and doors are properly closed and locked', 
                    'All entertainment equipment such as big screen TVs, video game consoles, arcade-style gaming devices are secure', 
                    'Confirm that the supply closet has sufficient toiletries'],
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
        <div class="steps">
            <div class="step">
                <h3>Step 1: Visually check and confirm the following</h3>
                <div class="tasks">${taskHtml}</div>
            </div>
            <div class="step">
                <h3>Step 2: Upload two images for record keeping</h3>
                <div class="photos">
                    <div class="photo-upload">
                        <div class="photo-placeholder" id="placeholder-${uniquePhotoId1}">
                            <input type="file" id="${uniquePhotoId1}" name="photo" accept="image/*" style="display: none;">
                            <button class="add-photo-btn" onclick="document.getElementById('${uniquePhotoId1}').click();">+</button>
                            <button class="remove-photo-btn" style="display: none;" onclick="removePhoto('${uniquePhotoId1}');">x</button>
                        </div>
                    </div>
                    <div class="photo-upload">
                        <div class="photo-placeholder" id="placeholder-${uniquePhotoId2}">
                            <input type="file" id="${uniquePhotoId2}" name="photo" accept="image/*" style="display: none;">
                            <button class="add-photo-btn" onclick="document.getElementById('${uniquePhotoId2}').click();">+</button>
                            <button class="remove-photo-btn" style="display: none;" onclick="removePhoto('${uniquePhotoId2}');">x</button>
                        </div>
                    </div>
                </div>
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

        // Compress the image before displaying
        new Compressor(file, {
            quality: 0.75,
            maxWidth: 1920,
            maxHeight: 1920,
            success(result) {
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
                    img.style.maxWidth = '100px';
                    img.style.marginTop = '10px';
                    
                    // Show remove button and hide add button
                    photoContainer.querySelector('.add-photo-btn').style.display = 'none';
                    photoContainer.querySelector('.remove-photo-btn').style.display = 'block';
                };
                reader.readAsDataURL(result);
            },
            error(err) {
                console.error('Compression failed:', err.message);
            }
        });
    }
}

function removePhoto(photoId) {
    const photoContainer = document.getElementById(`placeholder-${photoId}`);
    const img = photoContainer.querySelector('img');
    if (img) {
        photoContainer.removeChild(img);
    }
    const fileInput = document.getElementById(photoId);
    fileInput.value = '';
    photoContainer.querySelector('.add-photo-btn').style.display = 'block';
    photoContainer.querySelector('.remove-photo-btn').style.display = 'none';
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
