// Initialize shop functionality
document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    try {
        // Initialize tab bar
        const tabBar = new TabBar('shopTabs', {
            defaultTab: 'serverwide',
            onTabChange: (tabId) => {
                console.log(`Tab changed to: ${tabId}`);
            }
        });

        // Setup modal handlers
        setupModalHandlers();
        
        // Update payment goal
        updatePaymentGoal();
        
        // Wait a short delay to ensure auth state is initialized
        setTimeout(() => {
            // Setup avatar preview
            setupAvatarPreview();
        }, 500);
    } catch (error) {
        console.error('Error initializing shop:', error);
        showToast('Error loading shop content. Please refresh the page.', 'error');
    } finally {
        hideLoading();
    }
});

// Modal handlers
function setupModalHandlers() {
    const closeBtn = document.querySelector('.close-btn');
    const modal = document.getElementById('purchaseModal');
    
    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };

        // Close modal when clicking outside
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    }
}

// Avatar preview functionality
function setupAvatarPreview() {
    const linkAccountBtn = document.getElementById('linkAccountBtn');
    const previewControls = document.getElementById('previewControls');
    const previewRankSelect = document.getElementById('previewRankSelect');
    const avatarPreview = document.getElementById('avatarPreview');
    const linkInfo = document.querySelector('.link-info');
    const avatarPlaceholder = document.querySelector('.avatar-placeholder');

    console.log('Setting up avatar preview');

    // Initialize the rank select dropdown
    if (previewRankSelect) {
        // Preview rank select change handler
        previewRankSelect.addEventListener('change', (event) => {
            console.log('Rank select changed to:', event.target.value);
            updateAvatarPreview(event.target.value);
        });
    }

    // Check if user is logged out explicitly
    const loggedOut = localStorage.getItem('logged_out') === 'true';
    if (loggedOut) {
        // User is explicitly logged out, show login UI
        if (linkAccountBtn) {
            linkAccountBtn.style.display = 'flex';
            linkAccountBtn.innerHTML = '<i class="fab fa-discord"></i> Login with Discord';
            linkAccountBtn.onclick = handleAuth;
        }
        if (linkInfo) {
            linkInfo.textContent = 'Login with Discord to view and customize your Minecraft avatar.';
            linkInfo.style.display = 'block';
        }
        if (previewControls) previewControls.style.display = 'none';
        return;
    }

    // Check if user is logged in - use the auth state from the navbar
    const userMenu = document.querySelector('.user-menu');
    const isLoggedIn = userMenu && window.getComputedStyle(userMenu).display === 'flex';

    if (!isLoggedIn) {
        // Double-check with username element
        const usernameElement = document.querySelector('.username');
        if (!usernameElement || !usernameElement.textContent.trim()) {
            // User is not logged in with Discord
            if (linkAccountBtn) {
                linkAccountBtn.style.display = 'flex';
                linkAccountBtn.innerHTML = '<i class="fab fa-discord"></i> Login with Discord';
                linkAccountBtn.onclick = handleAuth;
            }
            if (linkInfo) {
                linkInfo.textContent = 'Login with Discord to view and customize your Minecraft avatar.';
                linkInfo.style.display = 'block';
            }
            if (previewControls) previewControls.style.display = 'none';
            return;
        }
    }

    // At this point, we know the user is logged in
    // Get the username from the navbar
    const usernameElement = document.querySelector('.username');
    const username = usernameElement ? usernameElement.textContent.trim() : null;

    if (username) {
        // User is logged in and we have a username, show the avatar
        showMinecraftAvatar(username);
        if (previewControls) previewControls.style.display = 'block';
        if (linkAccountBtn) linkAccountBtn.style.display = 'none';
        if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
        if (linkInfo) linkInfo.style.display = 'none';
        return;
    }

    // Fallback to API check for Minecraft username
    checkLinkedMinecraftAccount().then(userData => {
        if (userData && userData.minecraft_username) {
            // User has a linked account, show the avatar
            showMinecraftAvatar(userData.minecraft_username);
            if (previewControls) previewControls.style.display = 'block';
            if (linkAccountBtn) linkAccountBtn.style.display = 'none';
            if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
            if (linkInfo) linkInfo.style.display = 'none';
        } else {
            // User is logged in but doesn't have a linked Minecraft account
            if (linkAccountBtn) {
                linkAccountBtn.style.display = 'flex';
                linkAccountBtn.innerHTML = '<i class="fas fa-link"></i> Link Minecraft Account';
                // Reset the original click handler for linking account
                linkAccountBtn.onclick = () => {
                    window.location.href = '/profile.html?tab=settings&action=link-minecraft';
                };
            }
            if (linkInfo) {
                linkInfo.textContent = 'Link your Minecraft account in your profile settings to see your avatar here.';
                linkInfo.style.display = 'block';
            }
        }
    }).catch(error => {
        console.error('Error checking Minecraft account:', error);
        // Fallback to showing the link button
        if (linkAccountBtn) {
            linkAccountBtn.style.display = 'flex';
            linkAccountBtn.innerHTML = '<i class="fas fa-link"></i> Link Minecraft Account';
            linkAccountBtn.onclick = () => {
                window.location.href = '/profile.html?tab=settings&action=link-minecraft';
            };
        }
    });
}

// Check if user has a linked Minecraft account from Supabase
async function checkLinkedMinecraftAccount() {
    try {
        // First check if we have a username in the navbar
        const usernameElement = document.querySelector('.username');
        if (usernameElement && usernameElement.textContent.trim()) {
            // We have a username in the navbar, use that
            return {
                minecraft_username: usernameElement.textContent.trim()
            };
        }
        
        // Check if user is logged out explicitly
        const loggedOut = localStorage.getItem('logged_out') === 'true';
        if (loggedOut) {
            return null;
        }
        
        // Get current user data from the API
        const response = await fetch('/api/user');
        if (!response.ok) {
            console.error('Failed to fetch user profile');
            return null;
        }
        
        const userData = await response.json();
        
        // For demo purposes, if we're in a development environment without a real API,
        // check if the username is displayed in the navbar and use that
        if (!userData || !userData.minecraft_username) {
            // Already checked navbar username above, so return null
            return null;
        }
        
        return userData;
    } catch (error) {
        console.error('Error checking Minecraft account:', error);
        return null;
    }
}

// Show Minecraft avatar with the given username
function showMinecraftAvatar(username = 'MHF_Steve') {
    if (!username || username.trim() === '') {
        console.warn('No username provided for Minecraft avatar');
        username = 'MHF_Steve';
    }
    
    console.log('Showing Minecraft avatar for:', username);
    
    const avatarPreview = document.getElementById('avatarPreview');
    if (!avatarPreview) return;
    
    // Clear placeholder
    avatarPreview.innerHTML = '';
    
    // Create name tag
    const nameTag = document.createElement('div');
    nameTag.className = 'minecraft-nametag';
    nameTag.innerHTML = `<span class="username">${username}</span>`;
    nameTag.id = 'minecraftNameTag';
    
    // Create avatar image
    const img = document.createElement('img');
    img.src = `https://mc-heads.net/body/${username}`;
    img.alt = 'Minecraft Avatar';
    img.id = 'avatarImage';
    img.onerror = () => {
        // If the avatar fails to load, use a default avatar
        img.src = 'https://mc-heads.net/body/MHF_Steve';
    };
    
    avatarPreview.appendChild(nameTag);
    avatarPreview.appendChild(img);
    
    // Show the preview controls
    const previewControls = document.getElementById('previewControls');
    if (previewControls) {
        previewControls.style.display = 'block';
    }
    
    // Hide the placeholder and link info
    const avatarPlaceholder = document.querySelector('.avatar-placeholder');
    const linkInfo = document.querySelector('.link-info');
    if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
    if (linkInfo) linkInfo.style.display = 'none';
    
    // Hide the link account button
    const linkAccountBtn = document.getElementById('linkAccountBtn');
    if (linkAccountBtn) linkAccountBtn.style.display = 'none';
    
    // Get the current selected rank from the dropdown
    const previewRankSelect = document.getElementById('previewRankSelect');
    let selectedRank = 'none';
    if (previewRankSelect && previewRankSelect.value) {
        selectedRank = previewRankSelect.value;
    }
    
    // Initialize with the selected rank or no rank
    setTimeout(() => {
        updateAvatarPreview(selectedRank);
    }, 100);
    
    console.log('Minecraft avatar displayed for:', username);
}

// Update avatar preview with selected rank
function updateAvatarPreview(rankId) {
    const avatarImage = document.getElementById('avatarImage');
    const nameTag = document.getElementById('minecraftNameTag');
    if (!avatarImage || !nameTag) return;
    
    console.log('Updating avatar preview with rank:', rankId);
    
    // Get username from the name tag
    let username = 'MHF_Steve';
    if (nameTag && nameTag.querySelector('.username')) {
        username = nameTag.querySelector('.username').textContent;
    }
    
    // Remove all previous rank preview classes
    avatarImage.className = '';
    
    // Reset styles
    avatarImage.style.boxShadow = 'none';
    avatarImage.style.border = '2px solid rgba(255, 255, 255, 0.2)';
    avatarImage.style.borderRadius = 'var(--radius-md)';
    
    // Add a class to the avatar based on the rank
    if (rankId !== 'none') {
        // Apply the CSS class for the rank preview
        avatarImage.classList.add(`${rankId}-preview`);
        
        // Get rank colors for direct style application
        const rankColors = {
            'shadow-enchanter': 'var(--rank-shadow)',
            'void-walker': 'var(--rank-void)',
            'ethereal-warden': 'var(--rank-ethereal)',
            'astral-guardian': 'var(--rank-astral)',
            'citizen': 'var(--rank-citizen)',
            'merchant': 'var(--rank-merchant)',
            'councilor': 'var(--rank-councilor)',
            'mayor': 'var(--rank-mayor)',
            'governor': 'var(--rank-governor)',
            'noble': 'var(--rank-noble)',
            'duke': 'var(--rank-duke)',
            'king': 'var(--rank-king)',
            'divine-ruler': 'var(--rank-divine)'
        };
        
        // Apply styles directly to ensure they take effect
        const rankColor = rankColors[rankId];
        if (rankColor) {
            avatarImage.style.boxShadow = `0 0 15px 5px ${rankColor}`;
            avatarImage.style.border = `2px solid ${rankColor}`;
            avatarImage.style.borderRadius = '5px';
        }
    }
    
    // Update name tag with rank prefix
    if (nameTag) {
        if (rankId === 'none') {
            nameTag.innerHTML = `<span class="username">${username}</span>`;
        } else {
            // Get rank display name
            const rankDisplayNames = {
                'shadow-enchanter': 'Shadow',
                'void-walker': 'Void',
                'ethereal-warden': 'Ethereal',
                'astral-guardian': 'Astral',
                'citizen': 'Citizen',
                'merchant': 'Merchant',
                'councilor': 'Councilor',
                'mayor': 'Mayor',
                'governor': 'Governor',
                'noble': 'Noble',
                'duke': 'Duke',
                'king': 'King',
                'divine-ruler': 'Divine'
            };
            
            const rankName = rankDisplayNames[rankId] || rankId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            // Update name tag with rank prefix
            nameTag.innerHTML = `<span class="rank-prefix ${rankId}-prefix">[${rankName}]</span> <span class="username">${username}</span>`;
        }
    }
    
    // Update the dropdown to match the selected rank
    const previewRankSelect = document.getElementById('previewRankSelect');
    if (previewRankSelect && previewRankSelect.value !== rankId) {
        previewRankSelect.value = rankId;
    }
    
    console.log('Avatar preview updated with rank:', rankId);
}

// Update payment goal display
async function updatePaymentGoal() {
    try {
        // In a real implementation, this would fetch the current payment goal from the server
        // For now, we'll use the hardcoded value from the HTML
        const response = await fetch('/api/payment-goal');
        if (response.ok) {
            const data = await response.json();
            const progressFill = document.querySelector('.progress-fill');
            const progressText = document.querySelector('.progress-text');
            
            if (progressFill && progressText && data) {
                const percentage = Math.min(100, Math.max(0, data.percentage));
                progressFill.style.width = `${percentage}%`;
                progressText.textContent = `${percentage}% Complete`;
            }
        }
    } catch (error) {
        console.error('Error updating payment goal:', error);
        // Silently fail - the default values in HTML will be used
    }
}

// Loading overlay functions
function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
}

// Purchase handling functions
async function purchaseRank(rankId, price) {
    showLoading();
    try {
        // Check if user is logged in - use the auth state from the navbar
        const userMenu = document.querySelector('.user-menu');
        const isLoggedIn = userMenu && userMenu.style.display === 'flex';
        
        if (!isLoggedIn) {
            throw new Error('Please log in to purchase ranks');
        }

        // Show purchase modal
        const modal = document.getElementById('purchaseModal');
        const rankNameElement = document.getElementById('rankName');
        const rankPriceElement = document.getElementById('rankPrice');
        
        if (modal && rankNameElement && rankPriceElement) {
            rankNameElement.textContent = rankId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            rankPriceElement.textContent = price.toFixed(2);
            modal.style.display = 'block';
        }
    } catch (error) {
        console.error('Error during purchase:', error);
        showToast(error.message || 'Error processing purchase. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function purchaseUpgrade(upgradeId, price) {
    showLoading();
    try {
        // Check if user is logged in - use the auth state from the navbar
        const userMenu = document.querySelector('.user-menu');
        const isLoggedIn = userMenu && userMenu.style.display === 'flex';
        
        if (!isLoggedIn) {
            throw new Error('Please log in to purchase upgrades');
        }

        // Show purchase modal
        const modal = document.getElementById('purchaseModal');
        const rankNameElement = document.getElementById('rankName');
        const rankPriceElement = document.getElementById('rankPrice');
        
        if (modal && rankNameElement && rankPriceElement) {
            rankNameElement.textContent = upgradeId
                .replace(/-to-/g, ' to ')
                .replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
            rankPriceElement.textContent = price.toFixed(2);
            modal.style.display = 'block';
        }
    } catch (error) {
        console.error('Error during upgrade:', error);
        showToast(error.message || 'Error processing upgrade. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Toast notification system
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
}

// Confirm purchase
async function confirmPurchase() {
    showLoading();
    try {
        const rankName = document.getElementById('rankName').textContent;
        const price = parseFloat(document.getElementById('rankPrice').textContent);

        // Make API call to process the purchase
        const response = await fetch('/api/purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rankName,
                price,
                type: rankName.toLowerCase().includes(' to ') ? 'upgrade' : 'rank'
            })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to process purchase');
        }

        // Hide modal
        const modal = document.getElementById('purchaseModal');
        if (modal) {
            modal.style.display = 'none';
        }

        showToast('Purchase successful! Your rank has been updated.', 'success');
        
        // Update avatar preview if on the preview page
        const previewRankSelect = document.getElementById('previewRankSelect');
        if (previewRankSelect) {
            const rankId = rankName.toLowerCase().replace(/\s+/g, '-');
            previewRankSelect.value = rankId;
            updateAvatarPreview(rankId);
        }
        
        // Update payment goal after purchase
        updatePaymentGoal();
    } catch (error) {
        console.error('Error confirming purchase:', error);
        showToast(error.message || 'Error confirming purchase. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}
