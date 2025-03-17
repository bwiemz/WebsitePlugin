// Profile page functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Load user data
    try {
        const response = await fetch('/api/user');
        if (!response.ok) {
            window.location.href = '/';
            return;
        }
        const user = await response.json();
        updateProfileUI(user);
        loadUserRanks(user.id);
        loadPurchaseHistory(user.id);
    } catch (error) {
        handleError(error, 'Failed to load profile data');
    }

    // Initialize settings form
    const settingsForm = document.getElementById('settingsForm');
    settingsForm.addEventListener('submit', handleSettingsSubmit);
});

function updateProfileUI(user) {
    // Update profile header
    const avatar = document.querySelector('.profile-avatar');
    const username = document.querySelector('.profile-username');
    const discordTag = document.querySelector('.profile-discord');
    const minecraftUser = document.querySelector('.profile-minecraft');
    const memberSince = document.querySelector('.member-since');

    // Use the same avatar format as the navbar
    avatar.src = user.avatar 
        ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png` 
        : '/images/default-avatar.png';
    username.textContent = user.username;
    discordTag.textContent = `Discord: ${user.username}#${user.discriminator || '0000'}`;
    minecraftUser.textContent = user.minecraft_username ? 
        `Minecraft: ${user.minecraft_username}` : 
        'Minecraft account not linked';

    // Format member since date using created_at from Supabase
    if (user.created_at) {
        const memberDate = new Date(user.created_at);
        memberSince.textContent = memberDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    } else {
        memberSince.textContent = 'Unknown';
    }

    // Set form values
    document.getElementById('minecraftUsername').value = user.minecraft_username || '';
    document.getElementById('emailNotifications').checked = user.email_notifications;
    document.getElementById('discordNotifications').checked = user.discord_notifications;
}

async function loadUserRanks(userId) {
    try {
        const response = await fetch(`/api/user/${userId}/ranks`);
        if (!response.ok) throw new Error('Failed to load ranks');
        
        const ranks = await response.json();
        const activeRanksCount = document.querySelector('.active-ranks');
        const ranksList = document.getElementById('activeRanks');
        
        activeRanksCount.textContent = ranks.length;
        
        if (ranks.length === 0) {
            ranksList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-crown"></i>
                    <p>No active ranks</p>
                    <a href="/shop.html" class="btn btn-primary">Browse Ranks</a>
                </div>
            `;
            return;
        }

        ranksList.innerHTML = ranks.map(rank => `
            <div class="rank-item ${rank.name.toLowerCase().replace(' ', '-')}">
                <div class="rank-item-header">
                    <i class="fas ${getRankIcon(rank.name)}"></i>
                    <h3>${rank.name}</h3>
                </div>
                <ul class="rank-features">
                    ${rank.features.map(feature => 
                        `<li><i class="fas fa-check"></i> ${feature}</li>`
                    ).join('')}
                </ul>
                ${rank.expires_at ? `
                    <div class="rank-expiry">
                        <i class="fas fa-clock"></i>
                        Expires: ${new Date(rank.expires_at).toLocaleDateString()}
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (error) {
        handleError(error, 'Failed to load ranks');
    }
}

async function loadPurchaseHistory(userId) {
    try {
        const response = await fetch(`/api/user/${userId}/purchases`);
        if (!response.ok) throw new Error('Failed to load purchase history');
        
        const purchases = await response.json();
        const purchaseCount = document.querySelector('.total-purchases');
        const purchaseHistory = document.getElementById('purchaseHistory');
        
        purchaseCount.textContent = purchases.length;
        
        if (purchases.length === 0) {
            purchaseHistory.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fas fa-shopping-cart"></i>
                        <p>No purchases yet</p>
                    </td>
                </tr>
            `;
            return;
        }

        purchaseHistory.innerHTML = purchases.map(purchase => {
            // Format date with time
            const purchaseDate = new Date(purchase.created_at);
            const formattedDate = purchaseDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <tr class="purchase-row ${purchase.status.toLowerCase()}">
                    <td>${formattedDate}</td>
                    <td>
                        <span class="rank-name ${purchase.rank_name.toLowerCase().replace(' ', '-')}">
                            ${purchase.rank_name}
                        </span>
                    </td>
                    <td>£${purchase.price.toFixed(2)}</td>
                    <td>
                        <span class="status-badge ${purchase.status.toLowerCase()}">
                            ${getStatusIcon(purchase.status)}
                            ${purchase.status}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        handleError(error, 'Failed to load purchase history');
    }
}

async function handleSettingsSubmit(event) {
    event.preventDefault();
    showLoading();

    const formData = {
        minecraft_username: document.getElementById('minecraftUsername').value,
        email_notifications: document.getElementById('emailNotifications').checked,
        discord_notifications: document.getElementById('discordNotifications').checked
    };

    try {
        const response = await fetch('/api/user/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error('Failed to update settings');
        
        const user = await response.json();
        updateProfileUI(user);
        showToast('Settings updated successfully', 'success');
    } catch (error) {
        handleError(error, 'Failed to update settings');
    } finally {
        hideLoading();
    }
}

// Helper functions
function getRankIcon(rankName) {
    const icons = {
        'Shadow Enchanter': 'fa-hat-wizard',
        'Void Walker': 'fa-ghost',
        'Ethereal Warden': 'fa-shield-alt',
        'Astral Guardian': 'fa-sun',
        'Citizen': 'fa-home',
        'Merchant': 'fa-store',
        'Councilor': 'fa-scroll',
        'Mayor': 'fa-landmark',
        'Governor': 'fa-flag',
        'Noble': 'fa-chess-knight',
        'Duke': 'fa-chess-rook',
        'King': 'fa-crown',
        'Divine Ruler': 'fa-star'
    };
    return icons[rankName] || 'fa-crown';
}

function getStatusIcon(status) {
    const icons = {
        'completed': '<i class="fas fa-check-circle"></i>',
        'pending': '<i class="fas fa-clock"></i>',
        'failed': '<i class="fas fa-times-circle"></i>'
    };
    return icons[status.toLowerCase()] || '';
}

// Removed functions
// async function loadProfile() { ... }
// async function loadPurchaseHistory() { ... }
// async function loadUserRanks() { ... }
// async function linkMinecraft() { ... }
// async function unlinkMinecraft() { ... }
// async function unlinkDiscord() { ... }
// document.getElementById('emailNotifications')?.addEventListener('change', async (e) => { ... });
// document.getElementById('discordNotifications')?.addEventListener('change', async (e) => { ... });
