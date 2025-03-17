package com.mcshop.ranksync;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

public class ConfigManager {
    private final Path dataDirectory;
    private final Logger logger = LoggerFactory.getLogger(ConfigManager.class);
    private final Gson gson = new GsonBuilder().setPrettyPrinting().create();
    
    private String supabaseUrl = "your-project-url.supabase.co";
    private String supabaseKey = "your-supabase-anon-key";
    private int webhookPort = 8081;
    private String webhookSecret = "change_this_to_a_secure_secret";
    private Map<String, RankConfig> ranks = new HashMap<>();

    public ConfigManager(Path dataDirectory) {
        this.dataDirectory = dataDirectory;
        createDefaultConfig();
    }

    private void createDefaultConfig() {
        try {
            if (!Files.exists(dataDirectory)) {
                Files.createDirectories(dataDirectory);
            }

            File configFile = dataDirectory.resolve("config.json").toFile();
            if (!configFile.exists()) {
                // Create default ranks
                ranks.put("VIP", new RankConfig("VIP", "&a[VIP]", new String[]{
                    "fly.lobby",
                    "vip.chat",
                    "vip.perks"
                }));
                ranks.put("MVP", new RankConfig("MVP", "&b[MVP]", new String[]{
                    "fly.lobby",
                    "fly.survival",
                    "mvp.chat",
                    "mvp.perks"
                }));
                ranks.put("ELITE", new RankConfig("ELITE", "&5[ELITE]", new String[]{
                    "fly.*",
                    "elite.chat",
                    "elite.perks",
                    "elite.commands"
                }));

                // Create default config
                Config config = new Config();
                config.supabaseUrl = supabaseUrl;
                config.supabaseKey = supabaseKey;
                config.webhookPort = webhookPort;
                config.webhookSecret = webhookSecret;
                config.ranks = ranks;

                // Save to file
                String jsonConfig = gson.toJson(config);
                Files.writeString(configFile.toPath(), jsonConfig);
            }
        } catch (IOException e) {
            logger.error("Failed to create default config", e);
        }
    }

    public void loadConfig() {
        try {
            File configFile = dataDirectory.resolve("config.json").toFile();
            if (configFile.exists()) {
                String jsonConfig = Files.readString(configFile.toPath());
                Config config = gson.fromJson(jsonConfig, Config.class);

                this.supabaseUrl = config.supabaseUrl;
                this.supabaseKey = config.supabaseKey;
                this.webhookPort = config.webhookPort;
                this.webhookSecret = config.webhookSecret;
                this.ranks = config.ranks;
            }
        } catch (IOException e) {
            logger.error("Failed to load config", e);
        }
    }

    public String getSupabaseUrl() {
        return supabaseUrl;
    }

    public String getSupabaseKey() {
        return supabaseKey;
    }

    public int getWebhookPort() {
        return webhookPort;
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public Map<String, RankConfig> getRanks() {
        return ranks;
    }

    private static class Config {
        String supabaseUrl;
        String supabaseKey;
        int webhookPort;
        String webhookSecret;
        Map<String, RankConfig> ranks;
    }

    public static class RankConfig {
        private final String name;
        private final String prefix;
        private final String[] permissions;

        public RankConfig(String name, String prefix, String[] permissions) {
            this.name = name;
            this.prefix = prefix;
            this.permissions = permissions;
        }

        public String getName() {
            return name;
        }

        public String getPrefix() {
            return prefix;
        }

        public String[] getPermissions() {
            return permissions;
        }
    }
}
