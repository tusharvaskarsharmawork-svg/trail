// Popup Dashboard Logic
console.log('🎨 Popup loaded');

let currentFilter = 'all';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM loaded, initializing...');
  loadLearningData();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Filter tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      loadLearningData();
    });
  });

  // Clear button
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all learning data?')) {
      chrome.storage.local.set({ learningHistory: [] }, () => {
        showToast('🧹 All data cleared');
        loadLearningData();
      });
    }
  });
}

// Load and display learning data
function loadLearningData() {
  console.log('📊 Loading learning data...');
  
  chrome.storage.local.get(['learningHistory'], (result) => {
    const history = result.learningHistory || [];
    console.log(`Found ${history.length} topics in storage`);
    
    if (history.length === 0) {
      showEmptyState();
      return;
    }

    // Calculate memory retention for each entry
    const enrichedHistory = history.map(entry => ({
      ...entry,
      memoryScore: calculateMemoryRetention(entry)
    }));

    // Update stats
    updateStats(enrichedHistory);

    // Filter and display
    const filtered = filterEntries(enrichedHistory, currentFilter);
    console.log(`Displaying ${filtered.length} filtered topics`);
    displayMemoryCards(filtered);
  });
}

// Calculate memory retention using forgetting curve
function calculateMemoryRetention(entry) {
  const now = Date.now();
  const hoursPassed = (now - entry.learnedAt) / (1000 * 60 * 60);
  const halfLife = getHalfLife(entry.complexity);
  const retention = 100 * Math.pow(0.5, hoursPassed / halfLife);
  return Math.max(0, Math.min(100, retention));
}

// Get half-life hours based on complexity
function getHalfLife(complexity) {
  const halfLifeMap = { 1: 72, 2: 48, 3: 36, 4: 24, 5: 18 };
  return halfLifeMap[complexity] || 36;
}

// Filter entries based on memory score
function filterEntries(entries, filter) {
  if (filter === 'all') return entries;
  
  return entries.filter(entry => {
    const score = entry.memoryScore;
    if (filter === 'strong') return score >= 80;
    if (filter === 'review') return score >= 50 && score < 80;
    if (filter === 'forgotten') return score < 50;
    return true;
  });
}

// Update statistics
function updateStats(entries) {
  const total = entries.length;
  const needsReview = entries.filter(e => e.memoryScore < 50).length;
  const avgMemory = total > 0 ? entries.reduce((sum, e) => sum + e.memoryScore, 0) / total : 0;

  document.getElementById('totalLearned').textContent = total;
  document.getElementById('needsReview').textContent = needsReview;
  document.getElementById('avgMemory').textContent = Math.round(avgMemory) + '%';
}

// Display memory cards
function displayMemoryCards(entries) {
  const container = document.getElementById('memoryList');
  const emptyState = document.getElementById('emptyState');

  if (entries.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  
  // Clear existing content
  container.innerHTML = '';
  
  // Create cards
  entries.forEach(entry => {
    const card = createMemoryCard(entry);
    container.appendChild(card);
  });
  
  console.log(`✅ ${entries.length} cards rendered with event listeners`);
}

// Create a single memory card element
function createMemoryCard(entry) {
  const memoryClass = getMemoryClass(entry.memoryScore);
  const timeAgo = getTimeAgo(entry.learnedAt);
  const complexityStars = '⭐'.repeat(entry.complexity);
  const reviewCount = entry.reviewCount || 0;
  
  // Create card element
  const card = document.createElement('div');
  card.className = `memory-card ${memoryClass}`;
  card.dataset.id = entry.id;
  
  card.innerHTML = `
    <div class="card-header">
      <div class="memory-score">${Math.round(entry.memoryScore)}%</div>
      <div class="complexity" title="Complexity: ${entry.complexity}/5">${complexityStars}</div>
    </div>
    
    <h3 class="card-title">${escapeHtml(truncate(entry.mainTopic, 60))}</h3>
    
    <div class="concepts">
      ${entry.concepts.map(c => `<span class="concept-tag">${escapeHtml(truncate(c, 30))}</span>`).join('')}
    </div>
    
    <p class="card-summary">${escapeHtml(truncate(entry.summary, 120))}</p>
    
    <div class="card-footer">
      <span class="time-ago">${timeAgo}</span>
      <span class="domain-tag">${escapeHtml(entry.domain)}</span>
      ${reviewCount > 0 ? `<span class="review-badge">📚 ${reviewCount}</span>` : ''}
    </div>
    
    <div class="card-actions"></div>
  `;
  
  // Add action buttons with event listeners
  const actionsDiv = card.querySelector('.card-actions');
  
  // View button (link)
  const viewLink = document.createElement('a');
  viewLink.href = entry.url;
  viewLink.target = '_blank';
  viewLink.className = 'action-btn btn-view';
  viewLink.textContent = 'View Original →';
  actionsDiv.appendChild(viewLink);
  
  // Restore button (only for forgotten topics)
  if (entry.memoryScore < 50) {
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'action-btn btn-restore';
    restoreBtn.textContent = '💪 I Remember!';
    restoreBtn.addEventListener('click', () => {
      console.log('🔄 Restoring memory for:', entry.id);
      restoreMemory(entry.id);
    });
    actionsDiv.appendChild(restoreBtn);
  }
  
  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-btn btn-delete';
  deleteBtn.textContent = '🗑️ Remove';
  deleteBtn.addEventListener('click', () => {
    console.log('🗑️ Deleting topic:', entry.id);
    deleteTopic(entry.id);
  });
  actionsDiv.appendChild(deleteBtn);
  
  return card;
}

// Delete topic
function deleteTopic(topicId) {
  if (!confirm('Are you sure you want to remove this topic?')) {
    return;
  }
  
  console.log('Sending delete message for:', topicId);
  
  chrome.runtime.sendMessage({
    action: 'deleteTopic',
    id: topicId
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Delete error:', chrome.runtime.lastError);
      showToast('❌ Error deleting topic');
    } else {
      console.log('✅ Topic deleted successfully');
      showToast('🗑️ Topic removed successfully!');
      setTimeout(() => loadLearningData(), 300);
    }
  });
}

// Restore memory strength
function restoreMemory(topicId) {
  console.log('Sending restore message for:', topicId);
  
  chrome.runtime.sendMessage({
    action: 'updateMemory',
    id: topicId
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Restore error:', chrome.runtime.lastError);
      showToast('❌ Error updating memory');
    } else {
      console.log('✅ Memory updated successfully');
      showToast('✅ Memory updated! Topic moved to Strong category.');
      setTimeout(() => loadLearningData(), 300);
    }
  });
}

// Show toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Get memory class for styling
function getMemoryClass(score) {
  if (score >= 80) return 'memory-strong';
  if (score >= 50) return 'memory-review';
  return 'memory-forgotten';
}

// Format time ago
function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Truncate text
function truncate(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show empty state
function showEmptyState() {
  document.getElementById('memoryList').innerHTML = '';
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('totalLearned').textContent = '0';
  document.getElementById('needsReview').textContent = '0';
  document.getElementById('avgMemory').textContent = '0%';
}