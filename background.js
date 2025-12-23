// Background Service Worker - The AI Brain

// ⚠️ IMPORTANT: Replace with your actual Gemini API key
const GEMINI_API_KEY = '--------';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Listen to messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', message.action);
  
  if (message.action === 'trackLearning') {
    // Process async but respond immediately
    processLearningData(message.data).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      console.error('Processing error:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open for async response
    
  } else if (message.action === 'deleteTopic') {
    deleteTopic(message.id).then(() => {
      sendResponse({ success: true });
    });
    return true;
    
  } else if (message.action === 'updateMemory') {
    updateMemoryStrength(message.id).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Process learning data with Gemini AI
async function processLearningData(data) {
  try {
    console.log('📥 Processing learning data:', data.title);
    
    // STEP 1: Check if this is educational content using Gemini
    const isEducational = await checkIfEducational(data);
    if (!isEducational) {
      console.log('⏭️ Skipped: Not educational content (entertainment/music/vlog)');
      return;
    }
    
    console.log('✅ Educational content confirmed');
    
    // STEP 2: Analyze with Gemini
    const analysis = await analyzeWithGemini(data);
    
    if (analysis) {
      // STEP 3: Check if topic already exists
      const existingTopic = await findExistingTopic(analysis.mainTopic);
      
      if (existingTopic) {
        // UPDATE existing topic
        await updateExistingTopic(existingTopic.id, data, analysis);
        console.log('🔄 Updated existing topic:', analysis.mainTopic);
      } else {
        // CREATE new topic
        const entry = {
          id: generateId(),
          mainTopic: analysis.mainTopic,
          title: data.title,
          url: data.url,
          timeSpent: data.timeSpent,
          learnedAt: data.timestamp,
          lastReviewed: data.timestamp,
          reviewCount: 0,
          concepts: analysis.concepts,
          summary: analysis.summary,
          complexity: analysis.complexity,
          domain: analysis.domain
        };
        
        await saveLearningEntry(entry);
        console.log('✅ New topic saved:', entry.mainTopic);
      }
    }
  } catch (error) {
    console.error('❌ Error processing learning:', error);
  }
}

// NEW: Check if content is educational using Gemini
async function checkIfEducational(data) {
  if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    console.log('⚠️ No API key - using basic check');
    return isLikelyEducational(data.url, data.title);
  }

  const prompt = `You are an educational content classifier. Analyze if this is EDUCATIONAL/LEARNING content.

Title: ${data.title}
URL: ${data.url}
Content snippet: ${data.content.substring(0, 800)}

EDUCATIONAL content includes:
✅ Tutorials, lectures, courses, lessons
✅ How-to guides, explanations, documentation
✅ Programming/coding tutorials
✅ Academic subjects (math, science, history, language)
✅ Skill-building content (design, music theory, cooking techniques)
✅ Educational documentaries

NOT EDUCATIONAL (entertainment):
❌ Music videos, songs, albums
❌ Movie/TV show clips, trailers, reviews
❌ Gaming entertainment (Let's Plays, streams)
❌ Vlogs, daily life content
❌ Comedy sketches, memes
❌ Sports highlights, match replays
❌ News/current events

Answer with ONLY one word: "YES" or "NO"`;

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.1,
          maxOutputTokens: 10
        }
      })
    });

    if (!response.ok) {
      console.warn('Educational check API failed, using fallback');
      return isLikelyEducational(data.url, data.title);
    }

    const result = await response.json();
    
    if (!result.candidates || !result.candidates[0] || 
        !result.candidates[0].content || !result.candidates[0].content.parts) {
      return isLikelyEducational(data.url, data.title);
    }
    
    const answer = result.candidates[0].content.parts[0].text.trim().toUpperCase();
    const isEdu = answer.includes('YES');
    
    console.log(`🤖 Gemini says: ${answer} (${isEdu ? 'Educational' : 'Entertainment'})`);
    return isEdu;
    
  } catch (error) {
    console.error('Educational check error:', error.message);
    return isLikelyEducational(data.url, data.title);
  }
}

// Fallback educational check
function isLikelyEducational(url, title) {
  const titleLower = title.toLowerCase();
  
  // Entertainment keywords (BLOCK these)
  const entertainmentKeywords = [
    'song', 'music video', 'official video', 'lyric', 'lyrics',
    'trailer', 'movie', 'full movie', 'film', 'episode',
    'vlog', 'daily vlog', 'my day', 'lifestyle',
    'funny', 'comedy', 'meme', 'prank',
    'gameplay', 'let\'s play', 'gaming', 'stream',
    'reaction', 'reacting to', 'review',
    'news', 'breaking news', 'latest news',
    'highlights', 'match', 'goals', 'sports'
  ];
  
  // Educational keywords (ALLOW these)
  const eduKeywords = [
    'tutorial', 'learn', 'course', 'lecture', 'lesson',
    'guide', 'how to', 'explained', 'explanation',
    'programming', 'coding', 'python', 'javascript', 'java',
    'mathematics', 'math', 'calculus', 'algebra',
    'physics', 'chemistry', 'biology', 'science',
    'history', 'geography', 'economics',
    'language learning', 'grammar', 'vocabulary',
    'study', 'exam', 'preparation', 'concept'
  ];
  
  // Check for entertainment keywords first (higher priority)
  const hasEntertainment = entertainmentKeywords.some(keyword => 
    titleLower.includes(keyword)
  );
  
  if (hasEntertainment) {
    console.log('🚫 Blocked: Entertainment keyword detected');
    return false;
  }
  
  // Then check for educational keywords
  const hasEducational = eduKeywords.some(keyword => 
    titleLower.includes(keyword)
  );
  
  if (hasEducational) {
    console.log('✅ Allowed: Educational keyword detected');
    return true;
  }
  
  // For YouTube, be more strict - default to false
  if (url.includes('youtube.com')) {
    console.log('⚠️ YouTube video without clear educational indicators - blocked');
    return false;
  }
  
  // For other educational platforms, default to true
  const eduDomains = ['coursera.org', 'udemy.com', 'khanacademy.org', 'edx.org'];
  if (eduDomains.some(domain => url.includes(domain))) {
    return true;
  }
  
  return false;
}

// Gemini AI Analysis with SUBJECT categorization
async function analyzeWithGemini(data) {
  if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    return getFallbackAnalysis(data);
  }

  const prompt = `You are an educational content analyzer. Create a BROAD SUBJECT CATEGORY, not just repeat the video title.

Video Title: ${data.title}
Content: ${data.content.substring(0, 2000)}

Instructions:
1. Create a BROAD SUBJECT NAME (2-4 words) that groups similar topics
   - Example: "JavaScript Promises Tutorial" → "JavaScript Programming"
   - Example: "Calculus Derivatives Explained" → "Calculus"
   - Example: "World War 2 History" → "World History"
   - Example: "Learn Python Basics" → "Python Programming"
   
2. Extract key concepts from THIS specific content
3. Provide complexity based on depth of content

Return ONLY valid JSON (no markdown, no extra text):
{
  "mainTopic": "Broad subject (e.g., 'JavaScript Programming', 'Calculus', 'Physics')",
  "concepts": ["specific concept 1", "specific concept 2", "specific concept 3"],
  "summary": "What this specific video/content teaches in 2-3 sentences",
  "complexity": 3,
  "domain": "programming/math/science/history/language/business/design/etc"
}

Complexity scale:
1 = Beginner/Basic (introductory concepts)
2 = Elementary (simple topics)
3 = Intermediate (requires some background)
4 = Advanced (complex interconnected ideas)
5 = Expert (highly specialized/theoretical)

Keep mainTopic SHORT and BROAD (not the video title). Extract 3-5 specific concepts.`;

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.4,
          maxOutputTokens: 600
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.candidates || !result.candidates[0] || 
        !result.candidates[0].content || !result.candidates[0].content.parts ||
        !result.candidates[0].content.parts[0]) {
      throw new Error('Invalid API response structure');
    }
    
    const text = result.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const validated = validateAnalysis(parsed);
      console.log('📚 Subject identified:', validated.mainTopic);
      return validated;
    }
    
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('Gemini analysis error:', error.message);
    return getFallbackAnalysis(data);
  }
}

// Find existing topic by name similarity
async function findExistingTopic(mainTopic) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['learningHistory'], (result) => {
      const history = result.learningHistory || [];
      const normalizedTopic = mainTopic.toLowerCase().trim();
      
      const existing = history.find(item => {
        const itemTopic = item.mainTopic.toLowerCase().trim();
        return itemTopic === normalizedTopic || 
               itemTopic.includes(normalizedTopic) || 
               normalizedTopic.includes(itemTopic);
      });
      
      resolve(existing);
    });
  });
}

// Update existing topic
async function updateExistingTopic(topicId, newData, analysis) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['learningHistory'], (result) => {
      const history = result.learningHistory || [];
      const index = history.findIndex(item => item.id === topicId);
      
      if (index !== -1) {
        // Merge concepts (avoid duplicates)
        const mergedConcepts = [...new Set([...history[index].concepts, ...analysis.concepts])].slice(0, 8);
        
        history[index] = {
          ...history[index],
          timeSpent: history[index].timeSpent + newData.timeSpent,
          lastReviewed: newData.timestamp,
          reviewCount: history[index].reviewCount + 1,
          concepts: mergedConcepts,
          summary: analysis.summary, // Update with latest
        };
        
        chrome.storage.local.set({ learningHistory: history }, resolve);
      } else {
        resolve();
      }
    });
  });
}

// NEW: Delete topic
async function deleteTopic(topicId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['learningHistory'], (result) => {
      const history = result.learningHistory || [];
      const filtered = history.filter(item => item.id !== topicId);
      chrome.storage.local.set({ learningHistory: filtered }, () => {
        console.log('🗑️ Topic deleted:', topicId);
        resolve();
      });
    });
  });
}

// NEW: Update memory strength (mark as strong again)
async function updateMemoryStrength(topicId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['learningHistory'], (result) => {
      const history = result.learningHistory || [];
      const index = history.findIndex(item => item.id === topicId);
      
      if (index !== -1) {
        // Reset learned time to now (memory becomes 100% again)
        history[index].learnedAt = Date.now();
        history[index].lastReviewed = Date.now();
        
        chrome.storage.local.set({ learningHistory: history }, () => {
          console.log('💪 Memory strength updated:', topicId);
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

// Save new learning entry
async function saveLearningEntry(entry) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['learningHistory'], (result) => {
      const history = result.learningHistory || [];
      history.unshift(entry);
      const trimmed = history.slice(0, 100);
      chrome.storage.local.set({ learningHistory: trimmed }, resolve);
    });
  });
}

// Fallback analysis - creates broad subject from title
function getFallbackAnalysis(data) {
  const title = data.title;
  let mainTopic = title;
  let domain = 'general';
  let complexity = 3;
  
  // Extract broad subject from title
  const titleLower = title.toLowerCase();
  
  // Programming
  if (titleLower.includes('javascript') || titleLower.includes('js')) {
    mainTopic = 'JavaScript Programming';
    domain = 'programming';
    complexity = 3;
  } else if (titleLower.includes('python')) {
    mainTopic = 'Python Programming';
    domain = 'programming';
    complexity = 3;
  } else if (titleLower.includes('java') && !titleLower.includes('javascript')) {
    mainTopic = 'Java Programming';
    domain = 'programming';
    complexity = 3;
  } else if (titleLower.includes('react') || titleLower.includes('vue') || titleLower.includes('angular')) {
    mainTopic = 'Web Development';
    domain = 'programming';
    complexity = 4;
  } else if (titleLower.includes('html') || titleLower.includes('css')) {
    mainTopic = 'Web Development';
    domain = 'programming';
    complexity = 2;
  }
  // Math
  else if (titleLower.includes('calculus')) {
    mainTopic = 'Calculus';
    domain = 'mathematics';
    complexity = 4;
  } else if (titleLower.includes('algebra')) {
    mainTopic = 'Algebra';
    domain = 'mathematics';
    complexity = 3;
  } else if (titleLower.includes('math')) {
    mainTopic = 'Mathematics';
    domain = 'mathematics';
    complexity = 3;
  }
  // Science
  else if (titleLower.includes('physics')) {
    mainTopic = 'Physics';
    domain = 'science';
    complexity = 4;
  } else if (titleLower.includes('chemistry')) {
    mainTopic = 'Chemistry';
    domain = 'science';
    complexity = 4;
  } else if (titleLower.includes('biology')) {
    mainTopic = 'Biology';
    domain = 'science';
    complexity = 3;
  }
  // Other
  else if (titleLower.includes('history')) {
    mainTopic = 'History';
    domain = 'history';
    complexity = 3;
  } else if (titleLower.includes('english') || titleLower.includes('grammar')) {
    mainTopic = 'English Language';
    domain = 'language';
    complexity = 2;
  } else {
    // Keep first 40 chars as fallback
    mainTopic = title.substring(0, 40).trim();
  }
  
  return {
    mainTopic: mainTopic,
    concepts: [title.substring(0, 50)],
    summary: `Learning session: ${title}`,
    complexity: complexity,
    domain: domain
  };
}

// Validate analysis
function validateAnalysis(analysis) {
  return {
    mainTopic: typeof analysis.mainTopic === 'string' ? analysis.mainTopic : 'General Topic',
    concepts: Array.isArray(analysis.concepts) ? analysis.concepts.slice(0, 5) : ['General'],
    summary: typeof analysis.summary === 'string' ? analysis.summary : 'Learning session',
    complexity: (analysis.complexity >= 1 && analysis.complexity <= 5) ? analysis.complexity : 3,
    domain: typeof analysis.domain === 'string' ? analysis.domain : 'general'
  };
}

// Generate unique ID
function generateId() {
  return `learn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// NEW: Check for forgotten topics and send reminders
async function checkForgottenTopics() {
  chrome.storage.local.get(['learningHistory'], (result) => {
    const history = result.learningHistory || [];
    const now = Date.now();
    
    history.forEach(entry => {
      const hoursPassed = (now - entry.learnedAt) / (1000 * 60 * 60);
      const halfLife = getHalfLife(entry.complexity);
      const retention = 100 * Math.pow(0.5, hoursPassed / halfLife);
      
      // Alert if retention drops below 50%
      if (retention < 50 && retention > 30) {
        sendReminderNotification(entry);
      }
    });
  });
}

// Send Chrome notification for revision
function sendReminderNotification(entry) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: '⏰ Time to Review!',
    message: `Don't forget: "${entry.mainTopic}" - Memory at ${Math.round(entry.memoryScore || 0)}%`,
    priority: 2,
    requireInteraction: true
  });
}

// Calculate half-life
function getHalfLife(complexity) {
  const halfLifeMap = { 1: 72, 2: 48, 3: 36, 4: 24, 5: 18 };
  return halfLifeMap[complexity] || 36;
}

// Check for forgotten topics every hour
chrome.alarms.create('checkForgotten', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkForgotten') {
    checkForgottenTopics();
  }
});

// Install event
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎉 KDP installed! Start learning to track your knowledge.');
  }
});


console.log('🚀 KDP Background Service Active');

