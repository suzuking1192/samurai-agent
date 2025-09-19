// Samurai Agent Panel - Multi-tabbed Interface JavaScript
// Handles tab switching and panel functionality

document.addEventListener('DOMContentLoaded', function() {
    // Initialize tab functionality
    initializeTabs();
});

function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Add click event listeners to all tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
    
    // Set initial active tab (Chat)
    switchTab('chat');
}

function switchTab(tabName) {
    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.style.display = 'none';
    });
    
    // Show selected tab content and mark tab as active
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`${tabName}-content`);
    
    if (activeTab && activeContent) {
        activeTab.classList.add('active');
        activeContent.style.display = 'flex';
        
        // Focus chat input if switching to chat tab
        if (tabName === 'chat') {
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                setTimeout(() => chatInput.focus(), 100);
            }
        }
        
        // Initialize settings tab if switching to settings
        if (tabName === 'setting' && window.SettingsManager) {
            setTimeout(() => window.SettingsManager.renderSettings(), 100);
        }
    }
}

// Utility function to programmatically switch tabs (for future use)
function showTab(tabName) {
    switchTab(tabName);
}

// Export functions for potential external use
window.SamuraiAgentPanel = {
    switchTab: switchTab,
    showTab: showTab
};
