package com.mcshop.ranksync;

import net.luckperms.api.LuckPerms;
import net.luckperms.api.model.group.Group;
import net.luckperms.api.model.user.User;
import net.luckperms.api.node.Node;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.RegisteredServiceProvider;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.plugin.messaging.PluginMessageListener;

import java.util.concurrent.CompletableFuture;

public class RankSyncPaper extends JavaPlugin implements PluginMessageListener {
    private LuckPerms luckPerms;
    private RankManager rankManager;

    @Override
    public void onEnable() {
        // Initialize LuckPerms
        if (!setupLuckPerms()) {
            getLogger().severe("LuckPerms not found! Disabling plugin...");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        // Initialize rank manager
        rankManager = new RankManager(this, luckPerms);

        // Register plugin message channel
        getServer().getMessenger().registerIncomingPluginChannel(this, "ranksync:command", this);

        // Register event listeners
        getServer().getPluginManager().registerEvents(new PlayerListener(this), this);

        getLogger().info("RankSync Paper plugin has been enabled!");
    }

    @Override
    public void onDisable() {
        // Unregister plugin message channel
        getServer().getMessenger().unregisterIncomingPluginChannel(this);
        getLogger().info("RankSync Paper plugin has been disabled!");
    }

    private boolean setupLuckPerms() {
        RegisteredServiceProvider<LuckPerms> provider = Bukkit.getServicesManager().getRegistration(LuckPerms.class);
        if (provider != null) {
            luckPerms = provider.getProvider();
            return true;
        }
        return false;
    }

    @Override
    public void onPluginMessageReceived(String channel, Player player, byte[] message) {
        if (!channel.equals("ranksync:command")) {
            return;
        }

        String command = new String(message);
        String[] args = command.split(" ");

        if (args.length < 4 || !args[0].equals("ranksync") || !args[1].equals("apply")) {
            return;
        }

        String username = args[2];
        String rankName = args[3];
        String purchaseId = args[4];

        // Process rank update asynchronously
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            try {
                rankManager.applyRank(username, rankName, purchaseId);
            } catch (Exception e) {
                getLogger().severe("Error applying rank for " + username + ": " + e.getMessage());
            }
        });
    }

    public LuckPerms getLuckPerms() {
        return luckPerms;
    }

    public RankManager getRankManager() {
        return rankManager;
    }
}
