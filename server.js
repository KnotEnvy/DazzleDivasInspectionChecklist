//server.js

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 1137;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set up SQLite database
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run('CREATE TABLE tasks (roomName TEXT, tasks TEXT)');
    db.run('CREATE TABLE photos (roomName TEXT, photo BLOB)');
});

// Multer setup for handling file uploads
const upload = multer({ dest: 'uploads/' });

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API to save checklist data
app.post('/save', (req, res) => {
    const tasks = req.body;
    tasks.forEach(task => {
        db.run('INSERT INTO tasks (roomName, tasks) VALUES (?, ?)', [task.roomName, JSON.stringify(task.tasks)]);
    });
    res.send({ message: 'Checklist saved successfully' });
});

// API to save photos
app.post('/upload', upload.array('photos', 2), (req, res) => {
    const roomName = req.body.roomName;
    req.files.forEach(file => {
        const img = fs.readFileSync(file.path);
        db.run('INSERT INTO photos (roomName, photo) VALUES (?, ?)', [roomName, img]);
        fs.unlinkSync(file.path); // remove the file after saving to the database
    });
    res.send({ message: 'Photos uploaded successfully' });
});

// API to get checklist data
app.get('/load', (req, res) => {
    db.all('SELECT * FROM tasks', [], (err, rows) => {
        if (err) {
            res.status(500).send(err.message);
            return;
        }
        const tasks = rows.map(row => ({
            roomName: row.roomName,
            tasks: JSON.parse(row.tasks)
        }));
        res.send(tasks);
    });
});

// API to get photos
app.get('/photos', (req, res) => {
    db.all('SELECT * FROM photos', [], (err, rows) => {
        if (err) {
            res.status(500).send(err.message);
            return;
        }
        const photos = rows.map(row => ({
            roomName: row.roomName,
            photo: row.photo.toString('base64')
        }));
        res.send(photos);
    });
});

// API to delete photos after download
app.delete('/photos', (req, res) => {
    db.run('DELETE FROM photos', [], (err) => {
        if (err) {
            res.status(500).send(err.message);
            return;
        }
        res.send({ message: 'Photos deleted successfully' });
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
