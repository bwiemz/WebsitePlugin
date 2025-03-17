package com.mcshop.ranksync;

import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.proxy.server.RegisteredServer;
import org.json.JSONObject;
import org.slf4j.Logger;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

public class RankManager {
    private final ProxyServer server;
    private final Logger logger;
    private final SupabaseManager supabase;

    public RankManager(ProxyServer server, Logger logger, SupabaseManager supabase) {
        this.server = server;
        this.logger = logger;
        this.supabase = supabase;
    }

    public void syncPendingRanks() {
        supabase.getPendingRanks()
            .thenAccept(pendingRanks -> {
                pendingRanks.forEach((key, value) -> {
                    JSONObject rankData = new JSONObject((String) value);
                    String username = rankData.getString("username");
                    String rankName = rankData.getString("rank");
                    String purchaseId = rankData.getString("purchase_id");

                    processRankUpdate(username, rankName, purchaseId);
                });
            })
            .exceptionally(throwable -> {
                logger.error("Error syncing pending ranks", throwable);
                return null;
            });
    }

    public void processRankUpdate(String username, String rankName, String purchaseId) {
        // Find the player if they're online
        Optional<Player> playerOpt = server.getPlayer(username);
        
        if (playerOpt.isPresent()) {
            // Player is online, apply rank immediately
            applyRank(playerOpt.get(), rankName, purchaseId);
        } else {
            // Store the pending rank update
            supabase.queueRankUpdate(username, rankName, purchaseId)
                .thenAccept(success -> {
                    if (success) {
                        logger.info("Queued rank update for offline player: " + username);
                    } else {
                        logger.error("Failed to queue rank update for: " + username);
                    }
                });
        }
    }

    private void applyRank(Player player, String rankName, String purchaseId) {
        // Send rank update command to all backend servers
        String command = String.format("ranksync apply %s %s %s", 
            player.getUsername(), 
            rankName,
            purchaseId
        );

        for (RegisteredServer backendServer : server.getAllServers()) {
            sendCommandToServer(backendServer, command);
        }

        // Notify the player
        player.sendMessage(net.kyori.adventure.text.Component.text(
            "§aYour new rank §6" + rankName + " §ahas been applied!"
        ));

        // Update purchase status
        supabase.updatePurchaseStatus(purchaseId, "applied", "Rank has been applied successfully")
            .exceptionally(throwable -> {
                logger.error("Error updating purchase status", throwable);
                return null;
            });
    }

    private void sendCommandToServer(RegisteredServer server, String command) {
        try {
            server.sendPluginMessage(
                net.kyori.adventure.key.Key.key("ranksync", "command"),
                command.getBytes()
            );
        } catch (Exception e) {
            logger.error("Error sending command to server: " + server.getServerInfo().getName(), e);
        }
    }

    public void checkPendingRanks() {
        supabase.getPendingRanks()
            .thenAccept(pendingRanks -> {
                pendingRanks.forEach((key, value) -> {
                    JSONObject rankData = new JSONObject((String) value);
                    String username = rankData.getString("username");
                    String rankName = rankData.getString("rank");
                    String purchaseId = rankData.getString("purchase_id");

                    Optional<Player> playerOpt = server.getPlayer(username);
                    if (playerOpt.isPresent()) {
                        applyRank(playerOpt.get(), rankName, purchaseId);
                        supabase.markRankAsApplied(purchaseId)
                            .exceptionally(throwable -> {
                                logger.error("Error marking rank as applied", throwable);
                                return false;
                            });
                    }
                });
            })
            .exceptionally(throwable -> {
                logger.error("Error checking pending ranks", throwable);
                return null;
            });
    }
}
