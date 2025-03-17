package com.mcshop.ranksync;

import net.luckperms.api.LuckPerms;
import net.luckperms.api.model.group.Group;
import net.luckperms.api.model.user.User;
import net.luckperms.api.node.Node;
import net.luckperms.api.node.NodeType;
import net.luckperms.api.node.types.InheritanceNode;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;

public class RankManager {
    private final RankSyncPaper plugin;
    private final LuckPerms luckPerms;

    public RankManager(RankSyncPaper plugin, LuckPerms luckPerms) {
        this.plugin = plugin;
        this.luckPerms = luckPerms;
    }

    public void applyRank(String username, String rankName, String purchaseId) {
        // Get player UUID
        Player player = Bukkit.getPlayer(username);
        UUID uuid = player != null ? player.getUniqueId() : null;

        if (uuid == null) {
            // Try to get UUID from LuckPerms
            CompletableFuture<UUID> uuidFuture = luckPerms.getUserManager().lookupUniqueId(username);
            try {
                uuid = uuidFuture.get();
            } catch (Exception e) {
                plugin.getLogger().severe("Could not find UUID for player: " + username);
                return;
            }
        }

        // Check if rank exists
        Group rank = luckPerms.getGroupManager().getGroup(rankName);
        if (rank == null) {
            plugin.getLogger().severe("Rank does not exist: " + rankName);
            return;
        }

        // Load user data
        User user = luckPerms.getUserManager().loadUser(uuid).join();
        if (user == null) {
            plugin.getLogger().severe("Could not load user data for: " + username);
            return;
        }

        try {
            // Remove existing rank inheritance nodes
            user.data().clear(NodeType.INHERITANCE::matches);

            // Add new rank
            Node node = InheritanceNode.builder(rank).build();
            user.data().add(node);

            // Save changes
            luckPerms.getUserManager().saveUser(user);

            // Update player if online
            if (player != null) {
                Bukkit.getScheduler().runTask(plugin, () -> {
                    player.sendMessage("§aYour rank has been updated to §6" + rankName + "§a!");
                });
            }

            plugin.getLogger().info("Successfully applied rank " + rankName + " to " + username);
        } catch (Exception e) {
            plugin.getLogger().severe("Error applying rank " + rankName + " to " + username + ": " + e.getMessage());
        }
    }

    public void removeRank(String username, String rankName) {
        // Get player UUID
        Player player = Bukkit.getPlayer(username);
        UUID uuid = player != null ? player.getUniqueId() : null;

        if (uuid == null) {
            // Try to get UUID from LuckPerms
            CompletableFuture<UUID> uuidFuture = luckPerms.getUserManager().lookupUniqueId(username);
            try {
                uuid = uuidFuture.get();
            } catch (Exception e) {
                plugin.getLogger().severe("Could not find UUID for player: " + username);
                return;
            }
        }

        // Check if rank exists
        Group rank = luckPerms.getGroupManager().getGroup(rankName);
        if (rank == null) {
            plugin.getLogger().severe("Rank does not exist: " + rankName);
            return;
        }

        // Load user data
        User user = luckPerms.getUserManager().loadUser(uuid).join();
        if (user == null) {
            plugin.getLogger().severe("Could not load user data for: " + username);
            return;
        }

        try {
            // Remove rank
            Node node = InheritanceNode.builder(rank).build();
            user.data().remove(node);

            // Save changes
            luckPerms.getUserManager().saveUser(user);

            // Update player if online
            if (player != null) {
                Bukkit.getScheduler().runTask(plugin, () -> {
                    player.sendMessage("§cYour rank §6" + rankName + " §chas been removed!");
                });
            }

            plugin.getLogger().info("Successfully removed rank " + rankName + " from " + username);
        } catch (Exception e) {
            plugin.getLogger().severe("Error removing rank " + rankName + " from " + username + ": " + e.getMessage());
        }
    }

    public boolean hasRank(String username, String rankName) {
        // Get player UUID
        Player player = Bukkit.getPlayer(username);
        UUID uuid = player != null ? player.getUniqueId() : null;

        if (uuid == null) {
            // Try to get UUID from LuckPerms
            CompletableFuture<UUID> uuidFuture = luckPerms.getUserManager().lookupUniqueId(username);
            try {
                uuid = uuidFuture.get();
            } catch (Exception e) {
                return false;
            }
        }

        // Load user data
        User user = luckPerms.getUserManager().loadUser(uuid).join();
        if (user == null) {
            return false;
        }

        // Check if user has the rank
        return user.getInheritedGroups(user.getQueryOptions()).stream()
            .anyMatch(group -> group.getName().equals(rankName));
    }
}
