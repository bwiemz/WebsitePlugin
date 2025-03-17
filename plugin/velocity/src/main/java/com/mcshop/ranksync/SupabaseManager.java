package com.mcshop.ranksync;

import io.github.supabase.Client;
import io.github.supabase.ClientOptions;
import io.github.supabase.PostgrestResponse;
import io.github.supabase.data.PostgrestError;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public class SupabaseManager {
    private final Client supabase;
    private final RankSyncVelocity plugin;

    public SupabaseManager(RankSyncVelocity plugin, String supabaseUrl, String supabaseKey) {
        this.plugin = plugin;
        ClientOptions options = new ClientOptions(supabaseUrl, supabaseKey);
        this.supabase = new Client(options);
    }

    public CompletableFuture<Boolean> queueRankUpdate(String username, String rankName, String purchaseId) {
        Map<String, Object> rankUpdate = new HashMap<>();
        rankUpdate.put("username", username);
        rankUpdate.put("rank", rankName);
        rankUpdate.put("purchase_id", purchaseId);
        rankUpdate.put("status", "pending");
        rankUpdate.put("created_at", System.currentTimeMillis());

        return CompletableFuture.supplyAsync(() -> {
            try {
                PostgrestResponse response = supabase
                    .from("rank_updates")
                    .insert(rankUpdate)
                    .execute();

                if (response.hasError()) {
                    PostgrestError error = response.getError();
                    plugin.getLogger().severe("Error queueing rank update: " + error.getMessage());
                    return false;
                }
                return true;
            } catch (Exception e) {
                plugin.getLogger().severe("Error queueing rank update: " + e.getMessage());
                return false;
            }
        });
    }

    public CompletableFuture<Void> updatePurchaseStatus(String purchaseId, String status, String message) {
        Map<String, Object> statusUpdate = new HashMap<>();
        statusUpdate.put("status", status);
        statusUpdate.put("message", message);
        statusUpdate.put("updated_at", System.currentTimeMillis());

        return CompletableFuture.runAsync(() -> {
            try {
                PostgrestResponse response = supabase
                    .from("purchases")
                    .update(statusUpdate)
                    .eq("purchase_id", purchaseId)
                    .execute();

                if (response.hasError()) {
                    PostgrestError error = response.getError();
                    plugin.getLogger().severe("Error updating purchase status: " + error.getMessage());
                }
            } catch (Exception e) {
                plugin.getLogger().severe("Error updating purchase status: " + e.getMessage());
            }
        });
    }

    public CompletableFuture<Map<String, Object>> getPendingRanks() {
        return CompletableFuture.supplyAsync(() -> {
            try {
                PostgrestResponse response = supabase
                    .from("rank_updates")
                    .select()
                    .eq("status", "pending")
                    .execute();

                if (response.hasError()) {
                    PostgrestError error = response.getError();
                    plugin.getLogger().severe("Error getting pending ranks: " + error.getMessage());
                    return new HashMap<>();
                }

                return response.getData();
            } catch (Exception e) {
                plugin.getLogger().severe("Error getting pending ranks: " + e.getMessage());
                return new HashMap<>();
            }
        });
    }

    public CompletableFuture<Boolean> markRankAsApplied(String purchaseId) {
        Map<String, Object> update = new HashMap<>();
        update.put("status", "applied");
        update.put("applied_at", System.currentTimeMillis());

        return CompletableFuture.supplyAsync(() -> {
            try {
                PostgrestResponse response = supabase
                    .from("rank_updates")
                    .update(update)
                    .eq("purchase_id", purchaseId)
                    .execute();

                if (response.hasError()) {
                    PostgrestError error = response.getError();
                    plugin.getLogger().severe("Error marking rank as applied: " + error.getMessage());
                    return false;
                }
                return true;
            } catch (Exception e) {
                plugin.getLogger().severe("Error marking rank as applied: " + e.getMessage());
                return false;
            }
        });
    }

    // Subscribe to real-time rank updates
    public void subscribeToRankUpdates(RankManager rankManager) {
        supabase.realtime()
            .channel("rank_updates")
            .on("INSERT", payload -> {
                JSONObject data = new JSONObject(payload);
                String username = data.getString("username");
                String rankName = data.getString("rank");
                String purchaseId = data.getString("purchase_id");
                
                rankManager.processRankUpdate(username, rankName, purchaseId);
            })
            .subscribe();
    }
}
