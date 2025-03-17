package com.mcshop.ranksync;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import org.json.JSONObject;
import org.slf4j.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

public class WebhookListener {
    private final HttpServer server;
    private final RankSyncVelocity plugin;
    private final Logger logger;

    public WebhookListener(int port, RankSyncVelocity plugin) throws IOException {
        this.plugin = plugin;
        this.logger = plugin.getLogger();
        
        server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/webhook/purchase", new PurchaseWebhookHandler());
        server.setExecutor(Executors.newFixedThreadPool(4));
        server.start();
        
        logger.info("Webhook listener started on port " + port);
    }

    private class PurchaseWebhookHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "Method Not Allowed");
                return;
            }

            // Read request body
            String requestBody = readRequestBody(exchange.getRequestBody());
            
            try {
                JSONObject payload = new JSONObject(requestBody);
                
                // Validate webhook signature
                String signature = exchange.getRequestHeaders().getFirst("X-Webhook-Signature");
                if (!validateWebhookSignature(payload, signature)) {
                    sendResponse(exchange, 401, "Invalid signature");
                    return;
                }

                // Process the purchase
                processPurchase(payload);
                
                sendResponse(exchange, 200, "Purchase processed successfully");
            } catch (Exception e) {
                logger.error("Error processing webhook", e);
                sendResponse(exchange, 500, "Internal Server Error");
            }
        }

        private String readRequestBody(InputStream inputStream) throws IOException {
            StringBuilder body = new StringBuilder();
            byte[] buffer = new byte[1024];
            int length;
            while ((length = inputStream.read(buffer)) > 0) {
                body.append(new String(buffer, 0, length, StandardCharsets.UTF_8));
            }
            return body.toString();
        }

        private boolean validateWebhookSignature(JSONObject payload, String signature) {
            // TODO: Implement proper signature validation using HMAC
            // This should be implemented with a shared secret between the website and plugin
            return true; // Temporary for development
        }

        private void processPurchase(JSONObject payload) {
            String username = payload.getString("username");
            String rankName = payload.getString("rank");
            String purchaseId = payload.getString("purchaseId");

            // Update the rank through the RankManager
            plugin.getRankManager().updatePurchaseStatus(purchaseId, "processing", "Processing rank purchase");
            
            try {
                // Queue the rank update
                JSONObject rankUpdate = new JSONObject()
                    .put("username", username)
                    .put("rank", rankName)
                    .put("purchaseId", purchaseId);

                plugin.getRankManager().processRankUpdate(rankUpdate);
                
                plugin.getRankManager().updatePurchaseStatus(purchaseId, "queued", "Rank update queued");
            } catch (Exception e) {
                logger.error("Error processing purchase for " + username, e);
                plugin.getRankManager().updatePurchaseStatus(purchaseId, "error", e.getMessage());
            }
        }

        private void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            byte[] responseBytes = new JSONObject()
                .put("status", statusCode)
                .put("message", response)
                .toString()
                .getBytes(StandardCharsets.UTF_8);
            
            exchange.sendResponseHeaders(statusCode, responseBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(responseBytes);
            }
        }
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            logger.info("Webhook listener stopped");
        }
    }
}
