require('dotenv').config();
const express = require('express');
const path = require('path');  // Import the 'path' module
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const app = express();

const cookieParser = require('cookie-parser');
app.use(cookieParser());


// Use the environment variable PORT or default to 3000
const PORT = process.env.PORT || 3000;

app.use(express.json());  // For parsing JSON requests

// Secure password stored in .env
const correctPassword = process.env.PASSWORD;


// Default route serves the password page
app.get('/', (req, res) => {
    const loginTime = req.cookies.loginTime;
    const currentTime = new Date().getTime();

    console.log('loginTime:', loginTime);
    console.log('currentTime:', currentTime);

    if (loginTime && currentTime - loginTime < 60 * 1000) {
        console.log('Redirecting to story generator page.');
        res.redirect('/index.html');
    } else {
        console.log('Serving password page.');
        res.sendFile(path.join(__dirname, 'public', 'password.html'));
    }
});


// Validate password route
app.post('/validate-password', (req, res) => {
    const { password } = req.body;

    if (password === process.env.PASSWORD) {
        const loginTime = new Date().getTime();
        res.cookie('loginTime', loginTime, { maxAge: 60 * 1000 });  // Set cookie for 1 minute
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});


// Serve index.html only after password validation
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.use(express.static('public'));  // Serve the static HTML

// Secure OpenAI API Key stored in .env
const openaiApiKey = process.env.OPENAI_API_KEY;




// Route to handle generating a story
app.post('/generate-story', async (req, res) => {
    console.log('Received request:', req.body);
    const { prompt } = req.body;

    try {
        const apiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',  // Use a chat-based model
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that writes creative stories. For example, bedtime fairytales. If there are no other contradicting instructions, write a short and light story with less than 500 words.' },  // Optional system message
                    { role: 'user', content: prompt }  // User-provided prompt for the story
                ],
                max_tokens: 500,
            },
            {
                headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('API Response:', JSON.stringify(apiResponse.data, null, 2));

        // Check if choices and message content exist
        const story = apiResponse.data.choices && apiResponse.data.choices[0] && apiResponse.data.choices[0].message
            ? apiResponse.data.choices[0].message.content.trim()
            : 'No story generated';

        res.json({ story });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate story' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

