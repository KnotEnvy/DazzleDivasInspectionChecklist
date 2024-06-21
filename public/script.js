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

    async function fetchTasks() {
        const cachedTasks = localStorage.getItem('cachedTasks');
        const cacheExpiry = localStorage.getItem('cachedTasksExpiry');
        const now = new Date().getTime();

        if (cachedTasks && cacheExpiry && now < cacheExpiry) {
            return JSON.parse(cachedTasks);
        }

        const response = await fetch('/load');
        const tasks = await response.json();
        localStorage.setItem('cachedTasks', JSON.stringify(tasks));
        localStorage.setItem('cachedTasksExpiry', now + 60000); // Cache expires in 1 minute
        return tasks;
    }

    function updateRoomList(tasks) {
        roomListElement.innerHTML = ''; // Clear existing room list
        const fragment = document.createDocumentFragment();
        rooms.forEach(room => {
            const roomTasks = tasks.find(task => task.roomName === room.name);
            const completedTasks = roomTasks ? roomTasks.tasks.filter(Boolean).length : 0;
            const photosUploaded = roomTasks ? roomTasks.photos.filter(Boolean).length : 0;
            const totalTasks = room.itemCount;
            let statusClass = '';
            if (completedTasks === totalTasks && photosUploaded === 2) {
                statusClass = 'completed';
            } else if (completedTasks === totalTasks) {
                statusClass = 'partial';
            }
            const roomElement = document.createElement('div');
            roomElement.className = `room ${statusClass}`;
            roomElement.innerHTML = `
                <span class="room-name">${room.name}</span>
                <span class="item-count">${completedTasks}/${totalTasks} items</span>
                <span class="arrow">&gt;</span>
            `;
            roomElement.addEventListener('click', () => loadRoomDetails(room, detailContainer, roomTasks));
            fragment.appendChild(roomElement);
        });
        roomListElement.appendChild(fragment);
    }

    function generateUniqueID(prefix) {
        return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
    }

    function loadRoomDetails(room, container, roomTasks) {
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

        const taskState = roomTasks ? roomTasks.tasks : JSON.parse(localStorage.getItem(`${room.name}-tasks`)) || new Array(tasks[room.name].length).fill(false);
        const taskHtml = tasks[room.name].map((task, index) => `
            <div class="task">
                <input type="checkbox" id="task-${task.replace(/\s+/g, '-')}" name="task" ${taskState[index] ? 'checked' : ''} onclick="saveTaskState('${room.name}')">
                <label for="task-${task.replace(/\s+/g, '-')}"">${task}</label>
            </div>
        `).join('');

        const photoState = roomTasks ? roomTasks.photos : JSON.parse(localStorage.getItem(`${room.name}-photos`)) || ['', ''];

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
                                <button class="remove-photo-btn" style="display: none;" onclick="window.removePhoto('${uniquePhotoId1}', '${room.name}');">x</button>
                                ${photoState[0] ? `<img src="${photoState[0]}" style="display: block;">` : ''}
                            </div>
                        </div>
                        <div class="photo-upload">
                            <div class="photo-placeholder" id="placeholder-${uniquePhotoId2}">
                                <input type="file" id="${uniquePhotoId2}" name="photo" accept="image/*" style="display: none;">
                                <button class="add-photo-btn" onclick="document.getElementById('${uniquePhotoId2}').click();">+</button>
                                <button class="remove-photo-btn" style="display: none;" onclick="window.removePhoto('${uniquePhotoId2}', '${room.name}');">x</button>
                                ${photoState[1] ? `<img src="${photoState[1]}" style="display: block;">` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div> 
            <button onclick="window.toggleDetail(false)">Return to List</button>
        `;
        window.toggleDetail(true);
        setupPhotoUploads(room.name);
    }

    function setupPhotoUploads(roomName) {
        const photoInputs = document.querySelectorAll('.photo-upload input[type="file"]');
        photoInputs.forEach(input => {
            input.removeEventListener('change', handleFileChange);
            input.addEventListener('change', (event) => handleFileChange(event, roomName));
        });
    }

    function handleFileChange(event, roomName) {
        const file = event.target.files[0];
        const photoId = event.target.id;
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
                        const photoContainer = document.getElementById(`placeholder-${photoId}`);
                        let img = photoContainer.querySelector('img');
                        if (!img) {
                            img = document.createElement('img');
                            photoContainer.appendChild(img);
                        }
                        img.src = e.target.result;
                        img.style.display = 'block';

                        // Show remove button and hide add button
                        photoContainer.querySelector('.add-photo-btn').style.display = 'none';
                        photoContainer.querySelector('.remove-photo-btn').style.display = 'block';

                        // Save the photo state
                        const photoState = JSON.parse(localStorage.getItem(`${roomName}-photos`)) || ['', ''];
                        const photoIndex = photoId.endsWith('photo1') ? 0 : 1;
                        photoState[photoIndex] = e.target.result;
                        localStorage.setItem(`${roomName}-photos`, JSON.stringify(photoState));
                        updateRoomListLocal();
                    };
                    reader.readAsDataURL(result);
                },
                error(err) {
                    console.error('Compression failed:', err.message);
                }
            });

            // Upload the photo to the backend
            const formData = new FormData();
            formData.append('photos', file);
            formData.append('roomName', roomName);

            fetch('/upload', {
                method: 'POST',
                body: formData
            }).then(response => response.json())
              .then(data => console.log(data.message))
              .catch(error => console.error('Photo upload failed:', error));
        }
    }

    window.removePhoto = function(photoId, roomName) {
        const photoContainer = document.getElementById(`placeholder-${photoId}`);
        const img = photoContainer.querySelector('img');
        if (img) {
            photoContainer.removeChild(img);
        }
        const fileInput = document.getElementById(photoId);
        fileInput.value = '';
        photoContainer.querySelector('.add-photo-btn').style.display = 'block';
        photoContainer.querySelector('.remove-photo-btn').style.display = 'none';

        // Update the photo state
        const photoState = JSON.parse(localStorage.getItem(`${roomName}-photos`)) || ['', ''];
        const photoIndex = photoId.endsWith('photo1') ? 0 : 1;
        photoState[photoIndex] = '';
        localStorage.setItem(`${roomName}-photos`, JSON.stringify(photoState));
        updateRoomListLocal();
    };

    window.saveTaskState = function(roomName) {
        const taskCheckboxes = document.querySelectorAll('.tasks input[type="checkbox"]');
        const taskState = Array.from(taskCheckboxes).map(checkbox => checkbox.checked);
        localStorage.setItem(`${roomName}-tasks`, JSON.stringify(taskState));
        updateRoomListLocal();
    };

    function updateRoomListLocal() {
        const tasks = rooms.map(room => {
            const taskState = JSON.parse(localStorage.getItem(`${room.name}-tasks`)) || [];
            const photoState = JSON.parse(localStorage.getItem(`${room.name}-photos`)) || ['', ''];
            return { roomName: room.name, tasks: taskState, photos: photoState };
        });
        updateRoomList(tasks);
    }

    async function submitChecklist() {
        const tasks = rooms.map(room => {
            const taskState = JSON.parse(localStorage.getItem(`${room.name}-tasks`)) || [];
            const photoState = JSON.parse(localStorage.getItem(`${room.name}-photos`)) || ['', ''];
            return { roomName: room.name, tasks: taskState, photos: photoState };
        });

        // Send all data to the backend in one go
        await fetch('/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tasks),
        });

        alert('Checklist submitted successfully!');
        localStorage.clear(); // Clear localStorage after successful submission
        loadTaskState();
    }

    window.submitChecklist = submitChecklist;

    window.toggleDetail = function(show) {
        document.getElementById('detailContainer').style.display = show ? 'block' : 'none';
        document.getElementById('roomList').style.display = show ? 'none' : 'block';
        if (!show) {
            loadTaskState();
        }
    };

    function loadTaskState() {
        fetchTasks().then(tasks => {
            updateRoomList(tasks);
        });
    }

    loadTaskState();
    window.saveTaskState = saveTaskState;
    window.removePhoto = removePhoto;
    window.toggleDetail = toggleDetail;
    window.submitChecklist = submitChecklist;
});
