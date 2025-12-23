// Content Script - Learning Tracker
console.log('🧠 KDP Content Script Loaded');

let startTime = Date.now();
let isTracking = false;

// Start tracking when page loads
function startTracking() {
  if (isTracking) return;
  isTracking = true;
  startTime = Date.now();
  console.log('▶️ Started tracking:', document.title);
}

// Extract meaningful content
function extractContent() {
  const clone = document.body.cloneNode(true);
  
  // Remove unwanted elements
  clone.querySelectorAll('script, style, nav, footer, header, iframe, .ad, .advertisement').forEach(el => el.remove());
  
  let text = clone.innerText || clone.textContent || '';
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Limit to 3000 characters
  return text.slice(0, 3000);
}

// Track when user leaves page
function trackSession() {
  if (!isTracking) return;
  
  const timeSpent = Math.floor((Date.now() - startTime) / 1000);
  
  console.log(`⏱️ Time spent: ${timeSpent}s`);
  
  // Track if spent more than 30 seconds
  if (timeSpent >= 30) {
    const content = extractContent();
    
    if (content.length > 100) {
      const data = {
        title: document.title,
        url: window.location.href,
        content: content,
        timeSpent: timeSpent,
        timestamp: Date.now()
      };
      
      console.log('📤 Sending learning data to background...', {
        title: data.title,
        contentLength: content.length,
        timeSpent: timeSpent
      });
      
      // Send to background
      chrome.runtime.sendMessage({
        action: 'trackLearning',
        data: data
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Message error:', chrome.runtime.lastError);
        } else {
          console.log('✅ Message sent successfully');
        }
      });
    } else {
      console.log('⏭️ Not enough content to track');
    }
  } else {
    console.log('⏭️ Time too short (need 30s+)');
  }
  
  // Reset for next tracking session
  isTracking = false;
}

// Multiple tracking triggers
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('👁️ Page hidden - tracking session');
    trackSession();
  } else {
    console.log('👁️ Page visible - restarting tracking');
    startTime = Date.now(); // Reset start time
    isTracking = true;
  }
});

// Track when user navigates away
window.addEventListener('beforeunload', () => {
  console.log('🚪 Page unloading - tracking session');
  trackSession();
});

// Start tracking immediately
startTracking();

// Debug: Log current page info
console.log('📄 Current page:', {
  title: document.title,
  url: window.location.href,
  contentLength: document.body.innerText.length
});