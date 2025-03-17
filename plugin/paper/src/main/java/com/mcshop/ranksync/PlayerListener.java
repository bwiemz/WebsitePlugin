package com.mcshop.ranksync;

import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

public class PlayerListener implements Listener {
    private final RankSyncPaper plugin;

    public PlayerListener(RankSyncPaper plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        // Update player's permissions when they join
        plugin.getLuckPerms().getUserManager().loadUser(event.getPlayer().getUniqueId())
            .thenAcceptAsync(user -> {
                if (user != null) {
                    plugin.getLuckPerms().getUserManager().saveUser(user);
                }
            });
    }

    @EventHandler
    public void onPlayerQuit(PlayerQuitEvent event) {
        // Clean up any resources if needed
        plugin.getLuckPerms().getUserManager().cleanupUser(event.getPlayer().getUniqueId());
    }
}
