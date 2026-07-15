package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

const (
	writeWait        = 10 * time.Second
	pongWait         = 60 * time.Second
	pingPeriod       = (pongWait * 9) / 10
	maxMessageSize   = 512
	defaultJWTSecret = "clutch-dev-secret-change-in-production"
	authQueryParam   = "token"
)

var (
	errDisallowedOrigin  = errors.New("origin not allowed")
	errMissingCredential = errors.New("missing websocket credential")
	errInvalidCredential = errors.New("invalid websocket credential")
	defaultAllowedOrigin = []string{
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://localhost:3001",
		"http://127.0.0.1:3001",
	}
	connectionCounter atomic.Uint64
)

type presenceConfig struct {
	jwtSecret      string
	allowedOrigins map[string]struct{}
}

type presenceClaims struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	TokenType string `json:"tokenType"`
	jwt.RegisteredClaims
}

type Client struct {
	hub          *Hub
	conn         *websocket.Conn
	send         chan []byte
	userId       string
	connectionId string
}

func newConnectionID() string {
	return fmt.Sprintf("conn-%d-%d", time.Now().UnixMilli(), connectionCounter.Add(1))
}

func isIgnorableWebsocketCloseError(err error) bool {
	if err == nil {
		return true
	}

	if errors.Is(err, net.ErrClosed) {
		return true
	}

	message := err.Error()
	return strings.Contains(message, "websocket: close sent") ||
		strings.Contains(message, "use of closed network connection")
}

func loadPresenceConfig() presenceConfig {
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		secret = defaultJWTSecret
		writePresenceLog("warn", "presence_jwt_secret_fallback", "JWT_SECRET is empty; falling back to the default development secret. Never run production like this.", map[string]interface{}{
			"reason": "missing_jwt_secret",
		})
	}

	return presenceConfig{
		jwtSecret:      secret,
		allowedOrigins: buildAllowedOrigins(os.Getenv("PRESENCE_ALLOWED_ORIGINS")),
	}
}

func buildAllowedOrigins(raw string) map[string]struct{} {
	allowedOrigins := make(map[string]struct{})

	for _, origin := range strings.Split(raw, ",") {
		trimmed := strings.TrimSpace(origin)
		if trimmed == "" {
			continue
		}
		allowedOrigins[trimmed] = struct{}{}
	}

	if len(allowedOrigins) > 0 {
		return allowedOrigins
	}

	for _, origin := range defaultAllowedOrigin {
		allowedOrigins[origin] = struct{}{}
	}

	return allowedOrigins
}

func isOriginAllowed(origin string, allowedOrigins map[string]struct{}) bool {
	if strings.TrimSpace(origin) == "" {
		return false
	}

	_, ok := allowedOrigins[origin]
	return ok
}

func extractCredential(r *http.Request) (string, error) {
	authorization := strings.TrimSpace(r.Header.Get("Authorization"))
	if authorization != "" {
		scheme, token, found := strings.Cut(authorization, " ")
		if !found || !strings.EqualFold(strings.TrimSpace(scheme), "Bearer") || strings.TrimSpace(token) == "" {
			return "", errInvalidCredential
		}
		return strings.TrimSpace(token), nil
	}

	token := strings.TrimSpace(r.URL.Query().Get(authQueryParam))
	if token != "" {
		return token, nil
	}

	return "", errMissingCredential
}

func authenticateRequest(r *http.Request, cfg presenceConfig) (string, error) {
	tokenString, err := extractCredential(r)
	if err != nil {
		return "", err
	}

	token, err := jwt.ParseWithClaims(
		tokenString,
		&presenceClaims{},
		func(parsed *jwt.Token) (interface{}, error) {
			if parsed.Method != jwt.SigningMethodHS256 {
				return nil, errInvalidCredential
			}

			return []byte(cfg.jwtSecret), nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Name}),
	)
	if err != nil {
		return "", errInvalidCredential
	}

	claims, ok := token.Claims.(*presenceClaims)
	if !ok || !token.Valid || strings.TrimSpace(claims.ID) == "" {
		return "", errInvalidCredential
	}

	// Apenas access tokens autenticam o websocket; refresh tokens de longa
	// duracao nao podem ser reaproveitados como credencial de presence.
	if claims.TokenType != "" && claims.TokenType != "access" {
		return "", errInvalidCredential
	}

	return claims.ID, nil
}

func newUpgrader(cfg presenceConfig) websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return isOriginAllowed(r.Header.Get("Origin"), cfg.allowedOrigins)
		},
	}
}

func newPresenceHandler(hub *Hub, cfg presenceConfig) http.HandlerFunc {
	wsUpgrader := newUpgrader(cfg)

	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if !isOriginAllowed(origin, cfg.allowedOrigins) {
			writePresenceLog("warn", "websocket_origin_rejected", "WebSocket origin rejected", map[string]interface{}{
				"origin":     origin,
				"remoteAddr": r.RemoteAddr,
			})
			http.Error(w, errDisallowedOrigin.Error(), http.StatusForbidden)
			return
		}

		userID, err := authenticateRequest(r, cfg)
		if err != nil {
			fields := errorFields(err)
			fields["origin"] = origin
			fields["remoteAddr"] = r.RemoteAddr
			writePresenceLog("warn", "websocket_handshake_rejected", "WebSocket handshake rejected", fields)
			http.Error(w, "unauthorized websocket connection", http.StatusUnauthorized)
			return
		}

		writePresenceLog("info", "websocket_handshake_authenticated", "WebSocket handshake authenticated", map[string]interface{}{
			"userId":     userID,
			"origin":     origin,
			"remoteAddr": r.RemoteAddr,
		})

		conn, err := wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			fields := errorFields(err)
			fields["userId"] = userID
			fields["origin"] = origin
			writePresenceLog("error", "websocket_upgrade_failed", "WebSocket upgrade failed", fields)
			return
		}

		client := &Client{
			hub:          hub,
			conn:         conn,
			send:         make(chan []byte, 256),
			userId:       userID,
			connectionId: newConnectionID(),
		}

		writePresenceLog("info", "websocket_connection_opened", "WebSocket connection opened", map[string]interface{}{
			"userId":       userID,
			"connectionId": client.connectionId,
			"origin":       origin,
			"remoteAddr":   r.RemoteAddr,
		})

		hub.register <- client

		go client.writePump()
		go client.readPump()
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		if err := c.conn.Close(); err != nil {
			if !isIgnorableWebsocketCloseError(err) {
				fields := errorFields(err)
				fields["userId"] = c.userId
				fields["connectionId"] = c.connectionId
				writePresenceLog("error", "websocket_close_failed", "Failed to close websocket connection", fields)
			}
		}
		writePresenceLog("info", "websocket_connection_closed", "WebSocket connection closed", map[string]interface{}{
			"userId":       c.userId,
			"connectionId": c.connectionId,
		})
	}()

	c.conn.SetReadLimit(maxMessageSize)
	if err := c.conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
		fields := errorFields(err)
		fields["userId"] = c.userId
		fields["connectionId"] = c.connectionId
		writePresenceLog("error", "websocket_read_deadline_failed", "Failed to set websocket read deadline", fields)
		return
	}
	c.conn.SetPongHandler(func(string) error {
		writePresenceLog("info", "websocket_pong_received", "WebSocket pong received", map[string]interface{}{
			"userId":       c.userId,
			"connectionId": c.connectionId,
		})
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway, websocket.CloseNoStatusReceived) {
				break
			}

			if !isIgnorableWebsocketCloseError(err) {
				fields := errorFields(err)
				fields["userId"] = c.userId
				fields["connectionId"] = c.connectionId
				writePresenceLog("error", "websocket_read_failed", "Unexpected websocket read error", fields)
			}
			break
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err == nil && msg["event"] == "PING" {
			writePresenceLog("info", "websocket_ping_received", "WebSocket ping received", map[string]interface{}{
				"userId":       c.userId,
				"connectionId": c.connectionId,
			})

			pong, _ := json.Marshal(WsMessage{
				Event:   EventPong,
				Payload: nil,
				Ts:      time.Now().UnixMilli(),
			})
			c.send <- pong
			writePresenceLog("info", "websocket_pong_sent", "WebSocket pong sent", map[string]interface{}{
				"userId":       c.userId,
				"connectionId": c.connectionId,
			})
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		if err := c.conn.Close(); err != nil {
			if !isIgnorableWebsocketCloseError(err) {
				fields := errorFields(err)
				fields["userId"] = c.userId
				fields["connectionId"] = c.connectionId
				writePresenceLog("error", "websocket_close_failed", "Failed to close websocket connection", fields)
			}
		}
	}()

	for {
		select {
		case message, ok := <-c.send:
			if err := c.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				fields := errorFields(err)
				fields["userId"] = c.userId
				fields["connectionId"] = c.connectionId
				writePresenceLog("error", "websocket_write_deadline_failed", "Failed to set websocket write deadline", fields)
				return
			}
			if !ok {
				if err := c.conn.WriteMessage(websocket.CloseMessage, []byte{}); err != nil {
					if !isIgnorableWebsocketCloseError(err) {
						fields := errorFields(err)
						fields["userId"] = c.userId
						fields["connectionId"] = c.connectionId
						writePresenceLog("error", "websocket_close_message_failed", "Failed to write websocket close message", fields)
					}
				}
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				fields := errorFields(err)
				fields["userId"] = c.userId
				fields["connectionId"] = c.connectionId
				writePresenceLog("error", "websocket_write_failed", "Failed to write websocket message", fields)
				return
			}

		case <-ticker.C:
			if err := c.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				fields := errorFields(err)
				fields["userId"] = c.userId
				fields["connectionId"] = c.connectionId
				writePresenceLog("error", "websocket_write_deadline_failed", "Failed to set websocket write deadline", fields)
				return
			}
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				fields := errorFields(err)
				fields["userId"] = c.userId
				fields["connectionId"] = c.connectionId
				writePresenceLog("error", "websocket_ping_failed", "Failed to send websocket ping", fields)
				return
			}
			writePresenceLog("info", "websocket_ping_sent", "WebSocket ping sent", map[string]interface{}{
				"userId":       c.userId,
				"connectionId": c.connectionId,
			})
		}
	}
}

func main() {
	ctx := context.Background()
	cfg := loadPresenceConfig()

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		fields := errorFields(err)
		for key, value := range connectionLogFields("redis", redisURL, "parse_failed") {
			fields[key] = value
		}
		writePresenceLog("error", "redis_url_parse_failed", "Failed to parse Redis URL", fields)
		os.Exit(1)
	}

	redisClient := redis.NewClient(opt)
	if err := redisClient.Ping(ctx).Err(); err != nil {
		fields := errorFields(err)
		for key, value := range connectionLogFields("redis", redisURL, "connect_failed") {
			fields[key] = value
		}
		writePresenceLog("error", "redis_connect_failed", "Failed to connect to Redis", fields)
		os.Exit(1)
	}
	writePresenceLog("info", "redis_connected", "Connected to Redis", connectionLogFields("redis", redisURL, "connected"))

	hub := NewHub(redisClient)
	go hub.Run(ctx)

	http.HandleFunc("/ws/presence", newPresenceHandler(hub, cfg))

	http.HandleFunc("/stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]interface{}{
			"connections": hub.Count(),
			"service":     "clutch-presence",
			"status":      "ok",
		}); err != nil {
			fields := errorFields(err)
			fields["path"] = r.URL.Path
			writePresenceLog("error", "stats_encode_failed", "Failed to encode stats response", fields)
		}
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "clutch-presence",
		}); err != nil {
			fields := errorFields(err)
			fields["path"] = r.URL.Path
			writePresenceLog("error", "health_encode_failed", "Failed to encode health response", fields)
		}
	})

	port := os.Getenv("PRESENCE_PORT")
	if port == "" {
		port = "8080"
	}

	writePresenceLog("info", "presence_server_listening", "Presence service listening", map[string]interface{}{
		"port": port,
		"path": "/ws/presence",
	})
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		fields := errorFields(err)
		fields["port"] = port
		writePresenceLog("error", "presence_server_failed", "Presence service stopped unexpectedly", fields)
		os.Exit(1)
	}
}
