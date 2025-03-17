// Initialize home page functionality
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize any home page functionality here
        console.log('Home page initialized');
        
        // Setup copy IP button
        setupCopyIpButton();
        
        // Load featured ranks
        loadFeaturedRanks();
    } catch (error) {
        console.error('Error initializing home page:', error);
    }
});

// Setup copy IP button functionality
function setupCopyIpButton() {
    const copyIpBtn = document.getElementById('copyIpBtn');
    if (copyIpBtn) {
        copyIpBtn.addEventListener('click', () => {
            const serverIp = 'play.enderfall.com';
            
            // Copy to clipboard
            navigator.clipboard.writeText(serverIp)
                .then(() => {
                    // Show success message
                    const originalText = copyIpBtn.textContent;
                    copyIpBtn.textContent = 'IP Copied!';
                    copyIpBtn.classList.add('copied');
                    
                    // Reset button text after 2 seconds
                    setTimeout(() => {
                        copyIpBtn.textContent = originalText;
                        copyIpBtn.classList.remove('copied');
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy IP: ', err);
                    
                    // Fallback for browsers that don't support clipboard API
                    fallbackCopyTextToClipboard(serverIp);
                });
        });
    }
}

// Load featured ranks from the same data source as the shop
function loadFeaturedRanks() {
    // Featured ranks data (same as in tab-bar.js)
    const featuredRanks = [
        // First serverwide rank
        {
            name: 'Shadow Enchanter',
            price: 9.99,
            icon: 'fa-hat-wizard',
            features: [
                'Access to /fly command',
                '3 /sethome locations',
                'Colored chat messages',
                'Special chat prefix'
            ],
            category: 'Serverwide',
            position: 'Starter'
        },
        // Last serverwide rank
        {
            name: 'Astral Guardian',
            price: 39.99,
            icon: 'fa-sun',
            features: [
                'All Ethereal Warden features',
                'Access to /nick',
                '10 /sethome locations',
                'Custom particle trails'
            ],
            category: 'Serverwide',
            position: 'Ultimate'
        },
        // First towny rank
        {
            name: 'Citizen',
            price: 4.99,
            icon: 'fa-user',
            features: [
                'Create and join towns',
                'Basic town permissions',
                'Town chat access',
                'Town spawn access'
            ],
            category: 'Towny',
            position: 'Starter'
        },
        // Last towny rank
        {
            name: 'Divine Ruler',
            price: 44.99,
            icon: 'fa-crown',
            features: [
                'All King features',
                'Divine powers',
                'Custom events',
                'Ultimate perks'
            ],
            category: 'Towny',
            position: 'Ultimate'
        }
    ];

    // Get the featured ranks container
    const featuredRanksContainer = document.querySelector('.home-rank-grid');
    if (!featuredRanksContainer) return;

    // Clear existing content
    featuredRanksContainer.innerHTML = '';

    // Add each rank card
    featuredRanks.forEach(rank => {
        const rankCard = document.createElement('div');
        rankCard.className = `rank-card ${formatClassName(rank.name)}`;

        rankCard.innerHTML = `
            <div class="rank-header">
                <i class="fas ${rank.icon}"></i>
                <h3>${rank.name}</h3>
                <div class="rank-price">£${rank.price.toFixed(2)}</div>
            </div>
            <div class="rank-info">
                <div class="rank-category">${rank.category} Rank</div>
                <div class="rank-position">${rank.position} Tier</div>
                <ul class="rank-features">
                    ${rank.features.map(feature => `
                        <li><i class="fas fa-check"></i> ${feature}</li>
                    `).join('')}
                </ul>
                <a href="/shop.html" class="btn btn-primary">View Details</a>
            </div>
        `;

        featuredRanksContainer.appendChild(rankCard);
    });
}

// Helper function to format class names
function formatClassName(name) {
    return name.toLowerCase().replace(/\s+/g, '-');
}

// Fallback copy to clipboard method for older browsers
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        const copyIpBtn = document.getElementById('copyIpBtn');
        
        if (successful && copyIpBtn) {
            const originalText = copyIpBtn.textContent;
            copyIpBtn.textContent = 'IP Copied!';
            copyIpBtn.classList.add('copied');
            
            // Reset button text after 2 seconds
            setTimeout(() => {
                copyIpBtn.textContent = originalText;
                copyIpBtn.classList.remove('copied');
            }, 2000);
        }
    } catch (err) {
        console.error('Fallback: Could not copy text: ', err);
    }
    
    document.body.removeChild(textArea);
} 