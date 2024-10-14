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


// Middleware to enforce password protection
function enforcePassword(req, res, next) {
    const loginTime = req.cookies.loginTime;
    const currentTime = new Date().getTime();

    // If loginTime doesn't exist or the session has expired (e.g., 1 minute)
    if (!loginTime || currentTime - loginTime > 60 * 1000) {
        return res.redirect('/password.html');
    }
    next();
}

app.use(express.json());  // For parsing JSON requests

// Secure password stored in .env
const correctPassword = process.env.PASSWORD;


// Default route serves the password page
// Serve the password page as default if not authenticated
app.get('/', (req, res) => {
    res.redirect('/password.html');
});

// Password validation route
app.post('/validate-password', (req, res) => {
    const { password } = req.body;

    // Check password against environment variable
    if (password === process.env.PASSWORD) {
        // Set a cookie with the current login time
        const loginTime = new Date().getTime();
        res.cookie('loginTime', loginTime, { maxAge: 60 * 1000 });  // Cookie valid for 1 minute
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

// Serve index.html only after password validation
// Protect the following routes using the enforcePassword middleware
app.get('/index.html', enforcePassword, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/saved-stories.html', enforcePassword, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'saved-stories.html'));
});

app.use(express.static('public'));  // Serve the static HTML

// Secure OpenAI API Key stored in .env
const openaiApiKey = process.env.OPENAI_API_KEY;




// Route to handle generating a story
app.post('/generate-story', async (req, res) => {
    console.log('Received request:', req.body);
    const { prompt, style, complexity, length, characters, plot, scriptStyle, customScript } = req.body;

    // Construct the full prompt including the selected filters
    let fullPrompt = prompt;
    if (style !== 'none') fullPrompt += `. The style of a story should be sould be in a ${style} style`;
    if (complexity !== 'none') fullPrompt += `. The complexity sould be ${complexity}`;
    if (length !== 'none') fullPrompt += `. The length should be ${length}, ignore the specific numbers mentioned before`;
    if (characters !== 'none') fullPrompt += `. The story should be featuring ${characters}`;
    if (plot !== 'none') fullPrompt += `. The plot should have a ${plot} structure`;
    if (scriptStyle !== 'none') fullPrompt += `. The plot should be following the structure inspired by ${scriptStyle}`;
    if (typeof customScript === 'string' && customScript.trim() !== '') fullPrompt += ` in the style of the movie/genre "${customScript}"`;
    try {
        const apiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',  // Use a chat-based model
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that writes creative stories. For example, bedtime fairytales. If there are no other contradicting instructions, write a short and light story with less than 500 words.' },  // Optional system message
                    { role: 'user', content: fullPrompt }  // User-provided prompt for the story
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

app.delete('/api/stories/:id', async (req, res) => {
    try {
        const storyId = req.params.id;
        const deletedStory = await Story.findByIdAndDelete(storyId);

        if (!deletedStory) {
            return res.status(404).json({ message: 'Story not found' });
        }

        res.json({ message: 'Story deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete the story' });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

