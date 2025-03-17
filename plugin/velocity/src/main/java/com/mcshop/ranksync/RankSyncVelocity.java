package com.mcshop.ranksync;

import com.google.inject.Inject;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.ProxyServer;
import org.slf4j.Logger;

import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

@Plugin(
    id = "ranksync",
    name = "RankSync",
    version = "1.0-SNAPSHOT",
    description = "Synchronizes ranks between website and Minecraft servers",
    authors = {"MCShop"}
)
public class RankSyncVelocity {
    private final ProxyServer server;
    private final Logger logger;
    private final Path dataDirectory;
    private SupabaseManager supabaseManager;
    private RankManager rankManager;
    private WebhookListener webhookListener;

    @Inject
    public RankSyncVelocity(ProxyServer server, Logger logger, @DataDirectory Path dataDirectory) {
        this.server = server;
        this.logger = logger;
        this.dataDirectory = dataDirectory;
    }

    @Subscribe
    public void onProxyInitialization(ProxyInitializeEvent event) {
        // Initialize configuration
        ConfigManager configManager = new ConfigManager(dataDirectory);
        configManager.loadConfig();

        // Initialize Supabase connection
        initializeSupabase(configManager);

        // Initialize rank manager
        rankManager = new RankManager(server, logger, supabaseManager);

        // Initialize webhook listener
        webhookListener = new WebhookListener(configManager.getWebhookPort(), this);

        // Start background tasks
        startBackgroundTasks();

        logger.info("RankSync Velocity plugin has been initialized!");
    }

    private void initializeSupabase(ConfigManager configManager) {
        supabaseManager = new SupabaseManager(
            this,
            configManager.getSupabaseUrl(),
            configManager.getSupabaseKey()
        );

        // Subscribe to real-time rank updates
        supabaseManager.subscribeToRankUpdates(rankManager);
    }

    private void startBackgroundTasks() {
        // Schedule periodic rank sync check
        server.getScheduler()
            .buildTask(this, () -> rankManager.checkPendingRanks())
            .delay(30, TimeUnit.SECONDS)
            .repeat(30, TimeUnit.SECONDS)
            .schedule();
    }

    public ProxyServer getServer() {
        return server;
    }

    public Logger getLogger() {
        return logger;
    }

    public RankManager getRankManager() {
        return rankManager;
    }

    public SupabaseManager getSupabaseManager() {
        return supabaseManager;
    }

    public void onDisable() {
        if (webhookListener != null) {
            webhookListener.stop();
        }
    }
}
