require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration. Please check your .env file.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Test Supabase connection
(async () => {
    try {
        const { data, error } = await supabase.from('users').select('count').single();
        if (error) throw error;
        console.log('Successfully connected to Supabase');
    } catch (error) {
        console.error('Error connecting to Supabase:', error.message);
        process.exit(1);
    }
})();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60000 * 60 * 24 // 24 hours
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

const scopes = ['identify', 'email', 'guilds.join'];

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_REDIRECT_URI,
    scope: scopes
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user exists in Supabase
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('discord_id', profile.id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching user:', fetchError);
            return done(fetchError, null);
        }

        let user;
        if (!existingUser) {
            // Create new user in Supabase
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([{
                    discord_id: profile.id,
                    username: profile.username,
                    email: profile.email,
                    avatar: profile.avatar,
                    access_token: accessToken,
                    refresh_token: refreshToken
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Error creating user:', insertError);
                return done(insertError, null);
            }
            user = newUser;
        } else {
            // Update existing user
            const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update({
                    username: profile.username,
                    email: profile.email,
                    avatar: profile.avatar,
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    updated_at: new Date()
                })
                .eq('discord_id', profile.id)
                .select()
                .single();

            if (updateError) {
                console.error('Error updating user:', updateError);
                return done(updateError, null);
            }
            user = updatedUser;
        }

        // Add additional profile data
        const userProfile = {
            ...user,
            discriminator: profile.discriminator,
            avatar_url: profile.avatar 
                ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                : null
        };

        return done(null, userProfile);
    } catch (error) {
        console.error('Authentication error:', error);
        return done(error, null);
    }
}));

// Auth routes
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
    passport.authenticate('discord', {
        failureRedirect: '/'
    }),
    (req, res) => {
        res.redirect('/profile.html');
    }
);

app.get('/auth/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// Auth check middleware
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
};

// API Routes
app.get('/api/user', isAuthenticated, (req, res) => {
    try {
        const user = {
            id: req.user.id,
            discord_id: req.user.discord_id,
            username: req.user.username,
            email: req.user.email,
            avatar: req.user.avatar,
            minecraft_username: req.user.minecraft_username,
            email_notifications: req.user.email_notifications,
            discord_notifications: req.user.discord_notifications,
            created_at: req.user.created_at,
            discriminator: req.user.discriminator
        };
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

app.get('/api/user/ranks', isAuthenticated, async (req, res) => {
    try {
        const { data: ranks, error } = await supabase
            .from('user_ranks')
            .select(`
                id,
                name,
                description,
                features,
                expires_at
            `)
            .eq('user_id', req.user.id);

        if (error) throw error;
        res.json(ranks);
    } catch (error) {
        console.error('Error fetching user ranks:', error);
        res.status(500).json({ error: 'Failed to fetch user ranks' });
    }
});

app.post('/api/user/settings', isAuthenticated, async (req, res) => {
    try {
        const { minecraft_username, email_notifications, discord_notifications } = req.body;
        
        const { error } = await supabase
            .from('users')
            .update({
                minecraft_username,
                email_notifications,
                discord_notifications,
                updated_at: new Date()
            })
            .eq('id', req.user.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).json({ error: 'Failed to update user settings' });
    }
});

app.get('/api/purchases', isAuthenticated, async (req, res) => {
    try {
        const { data: purchases, error } = await supabase
            .from('purchases')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(purchases || []);
    } catch (error) {
        console.error('Error fetching purchases:', error);
        res.status(500).json({ error: 'Failed to fetch purchases' });
    }
});

app.post('/api/user/minecraft', isAuthenticated, async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        const { data, error } = await supabase
            .from('users')
            .update({ minecraft_username: username })
            .eq('id', req.user.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error linking Minecraft account:', error);
        res.status(500).json({ error: 'Failed to link Minecraft account' });
    }
});

app.delete('/api/user/minecraft', isAuthenticated, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .update({ minecraft_username: null })
            .eq('id', req.user.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error unlinking Minecraft account:', error);
        res.status(500).json({ error: 'Failed to unlink Minecraft account' });
    }
});

app.patch('/api/user/preferences', isAuthenticated, async (req, res) => {
    try {
        const { email_notifications, discord_notifications } = req.body;
        const updates = {};
        
        if (typeof email_notifications === 'boolean') {
            updates.email_notifications = email_notifications;
        }
        if (typeof discord_notifications === 'boolean') {
            updates.discord_notifications = discord_notifications;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid preferences provided' });
        }

        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', req.user.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

app.post('/api/purchase', isAuthenticated, async (req, res) => {
    const { rankName, price } = req.body;
    const userId = req.user.id;

    try {
        // Create purchase record in Supabase
        const { data, error } = await supabase
            .from('purchases')
            .insert([{
                user_id: userId,
                rank_name: rankName,
                price: price,
                status: 'pending'
            }])
            .select()
            .single();

        if (error) throw error;

        // Here you would typically:
        // 1. Process payment
        // 2. Update Discord roles
        // 3. Update Minecraft permissions

        res.json(data);
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ error: 'Failed to process purchase' });
    }
});

// Purchase routes
app.post('/api/purchase/rank', isAuthenticated, async (req, res) => {
    try {
        const { rankId, price } = req.body;

        // Validate rank exists
        const rankConfig = getRankConfig(rankId);
        if (!rankConfig) {
            return res.status(400).json({ error: 'Invalid rank selection' });
        }

        // Validate price matches
        if (rankConfig.price !== price) {
            return res.status(400).json({ error: 'Invalid price' });
        }

        // Create purchase record
        const { data: purchase, error: purchaseError } = await supabase
            .from('purchases')
            .insert({
                user_id: req.user.id,
                rank_name: rankConfig.name,
                price: price,
                status: 'pending'
            })
            .select()
            .single();

        if (purchaseError) throw purchaseError;

        // In a real implementation, we would:
        // 1. Create a payment session with Stripe/PayPal
        // 2. Return the session URL for client-side redirect
        // 3. Handle webhook for payment confirmation
        // 4. Update purchase status and apply rank

        // For now, simulate successful purchase
        const { error: rankError } = await supabase
            .from('user_ranks')
            .insert({
                user_id: req.user.id,
                name: rankConfig.name,
                description: rankConfig.description,
                features: rankConfig.features,
                expires_at: null
            });

        if (rankError) throw rankError;

        const { error: updateError } = await supabase
            .from('purchases')
            .update({ status: 'completed' })
            .eq('id', purchase.id);

        if (updateError) throw updateError;

        res.json({ success: true });
    } catch (error) {
        console.error('Error processing purchase:', error);
        res.status(500).json({ error: 'Failed to process purchase' });
    }
});

app.post('/api/purchase/upgrade', isAuthenticated, async (req, res) => {
    try {
        const { upgradeId, price } = req.body;

        // Validate upgrade exists and user has required rank
        const upgradeConfig = getUpgradeConfig(upgradeId);
        if (!upgradeConfig) {
            return res.status(400).json({ error: 'Invalid upgrade selection' });
        }

        // Check if user has the required rank
        const { data: currentRank, error: rankError } = await supabase
            .from('user_ranks')
            .select('name')
            .eq('user_id', req.user.id)
            .eq('name', upgradeConfig.from)
            .single();

        if (rankError || !currentRank) {
            return res.status(400).json({ error: 'You do not have the required rank for this upgrade' });
        }

        // Validate price matches
        if (upgradeConfig.price !== price) {
            return res.status(400).json({ error: 'Invalid price' });
        }

        // Create purchase record
        const { data: purchase, error: purchaseError } = await supabase
            .from('purchases')
            .insert({
                user_id: req.user.id,
                rank_name: upgradeConfig.to,
                price: price,
                status: 'pending'
            })
            .select()
            .single();

        if (purchaseError) throw purchaseError;

        // For now, simulate successful purchase
        const { error: deleteError } = await supabase
            .from('user_ranks')
            .delete()
            .eq('user_id', req.user.id)
            .eq('name', upgradeConfig.from);

        if (deleteError) throw deleteError;

        const { error: rankError2 } = await supabase
            .from('user_ranks')
            .insert({
                user_id: req.user.id,
                name: upgradeConfig.to,
                description: upgradeConfig.description,
                features: upgradeConfig.features,
                expires_at: null
            });

        if (rankError2) throw rankError2;

        const { error: updateError } = await supabase
            .from('purchases')
            .update({ status: 'completed' })
            .eq('id', purchase.id);

        if (updateError) throw updateError;

        res.json({ success: true });
    } catch (error) {
        console.error('Error processing upgrade:', error);
        res.status(500).json({ error: 'Failed to process upgrade' });
    }
});

// Rank configuration helpers
function getRankConfig(rankId) {
    const ranks = {
        // Serverwide Ranks
        'shadow-enchanter': {
            name: 'Shadow Enchanter',
            price: 9.99,
            description: 'A mystical rank with basic flying abilities',
            features: ['/fly', '3 /sethome', 'colored chat', 'special prefix']
        },
        'void-walker': {
            name: 'Void Walker',
            price: 19.99,
            description: 'Master of the void with enhanced storage',
            features: ['/enderchest', '5 /sethome', 'custom join messages']
        },
        'ethereal-warden': {
            name: 'Ethereal Warden',
            price: 29.99,
            description: 'Guardian of the realm with healing powers',
            features: ['/heal', '/feed', '7 /sethome', 'particle effects']
        },
        'astral-guardian': {
            name: 'Astral Guardian',
            price: 39.99,
            description: 'Supreme cosmic being with ultimate abilities',
            features: ['/nick', '10 /sethome', 'custom particle trails']
        },
        // Towny Ranks
        'citizen': {
            name: 'Citizen',
            price: 4.99,
            description: 'Basic towny privileges',
            features: ['Create town', '5 plots', '1 spawn']
        },
        'merchant': {
            name: 'Merchant',
            price: 9.99,
            description: 'Enhanced trading capabilities',
            features: ['2 shops', '10 plots']
        },
        'councilor': {
            name: 'Councilor',
            price: 14.99,
            description: 'Town management abilities',
            features: ['5 shops', 'town chat colors']
        },
        'mayor': {
            name: 'Mayor',
            price: 19.99,
            description: 'Full town control',
            features: ['multiple spawns', 'welcome message']
        },
        'governor': {
            name: 'Governor',
            price: 24.99,
            description: 'Nation creation privileges',
            features: ['create nation', 'nation chat prefix']
        },
        'noble': {
            name: 'Noble',
            price: 29.99,
            description: 'Advanced nation features',
            features: ['nation particles', 'custom spawn']
        },
        'duke': {
            name: 'Duke',
            price: 34.99,
            description: 'Nation-wide abilities',
            features: ['nation-wide effects', 'custom banner']
        },
        'king': {
            name: 'King',
            price: 39.99,
            description: 'Supreme nation control',
            features: ['nation commands', 'custom laws']
        },
        'divine-ruler': {
            name: 'Divine Ruler',
            price: 44.99,
            description: 'Ultimate towny authority',
            features: ['divine powers', 'custom events']
        }
    };

    return ranks[rankId];
}

function getUpgradeConfig(upgradeId) {
    const upgrades = {
        // Serverwide Upgrades
        'shadow-to-void': {
            from: 'Shadow Enchanter',
            to: 'Void Walker',
            price: 4.99,
            description: 'Upgrade to Void Walker rank',
            features: ['/enderchest', '5 /sethome', 'custom join messages']
        },
        'void-to-ethereal': {
            from: 'Void Walker',
            to: 'Ethereal Warden',
            price: 4.99,
            description: 'Upgrade to Ethereal Warden rank',
            features: ['/heal', '/feed', '7 /sethome', 'particle effects']
        },
        'ethereal-to-astral': {
            from: 'Ethereal Warden',
            to: 'Astral Guardian',
            price: 4.99,
            description: 'Upgrade to Astral Guardian rank',
            features: ['/nick', '10 /sethome', 'custom particle trails']
        },
        // Towny Upgrades
        'citizen-to-merchant': {
            from: 'Citizen',
            to: 'Merchant',
            price: 4.99,
            description: 'Upgrade to Merchant rank',
            features: ['2 shops', '10 plots']
        },
        'merchant-to-councilor': {
            from: 'Merchant',
            to: 'Councilor',
            price: 4.99,
            description: 'Upgrade to Councilor rank',
            features: ['5 shops', 'town chat colors']
        },
        'councilor-to-mayor': {
            from: 'Councilor',
            to: 'Mayor',
            price: 4.99,
            description: 'Upgrade to Mayor rank',
            features: ['multiple spawns', 'welcome message']
        },
        'mayor-to-governor': {
            from: 'Mayor',
            to: 'Governor',
            price: 4.99,
            description: 'Upgrade to Governor rank',
            features: ['create nation', 'nation chat prefix']
        },
        'governor-to-noble': {
            from: 'Governor',
            to: 'Noble',
            price: 4.99,
            description: 'Upgrade to Noble rank',
            features: ['nation particles', 'custom spawn']
        },
        'noble-to-duke': {
            from: 'Noble',
            to: 'Duke',
            price: 4.99,
            description: 'Upgrade to Duke rank',
            features: ['nation-wide effects', 'custom banner']
        },
        'duke-to-king': {
            from: 'Duke',
            to: 'King',
            price: 4.99,
            description: 'Upgrade to King rank',
            features: ['nation commands', 'custom laws']
        },
        'king-to-divine': {
            from: 'King',
            to: 'Divine Ruler',
            price: 4.99,
            description: 'Upgrade to Divine Ruler rank',
            features: ['divine powers', 'custom events']
        }
    };

    return upgrades[upgradeId];
}

// Serve static files
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
