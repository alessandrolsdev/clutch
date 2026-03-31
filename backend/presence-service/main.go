package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strings"
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
)

type presenceConfig struct {
	jwtSecret      string
	allowedOrigins map[string]struct{}
}

type presenceClaims struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	userId string
}

func loadPresenceConfig() presenceConfig {
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		secret = defaultJWTSecret
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
		if !isOriginAllowed(r.Header.Get("Origin"), cfg.allowedOrigins) {
			http.Error(w, errDisallowedOrigin.Error(), http.StatusForbidden)
			return
		}

		userID, err := authenticateRequest(r, cfg)
		if err != nil {
			http.Error(w, "unauthorized websocket connection", http.StatusUnauthorized)
			return
		}

		conn, err := wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("websocket upgrade error: %v", err)
			return
		}

		client := &Client{
			hub:    hub,
			conn:   conn,
			send:   make(chan []byte, 256),
			userId: userID,
		}

		hub.register <- client

		go client.writePump()
		go client.readPump()
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		if err := c.conn.Close(); err != nil {
			log.Printf("error closing connection: %v", err)
		}
	}()

	c.conn.SetReadLimit(maxMessageSize)
	if err := c.conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
		log.Printf("error setting read deadline: %v", err)
		return
	}
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("websocket error: %v", err)
			}
			break
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err == nil && msg["event"] == "PING" {
			pong, _ := json.Marshal(WsMessage{
				Event:   EventPong,
				Payload: nil,
				Ts:      time.Now().UnixMilli(),
			})
			c.send <- pong
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		if err := c.conn.Close(); err != nil {
			log.Printf("error closing connection: %v", err)
		}
	}()

	for {
		select {
		case message, ok := <-c.send:
			if err := c.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				log.Printf("error setting write deadline: %v", err)
				return
			}
			if !ok {
				if err := c.conn.WriteMessage(websocket.CloseMessage, []byte{}); err != nil {
					log.Printf("error writing close message: %v", err)
				}
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("error writing message: %v", err)
				return
			}

		case <-ticker.C:
			if err := c.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				log.Printf("error setting write deadline: %v", err)
				return
			}
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
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
		log.Fatalf("failed to parse Redis URL: %v", err)
	}

	redisClient := redis.NewClient(opt)
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("failed to connect to Redis: %v", err)
	}
	log.Println("connected to Redis")

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
			log.Printf("error encoding stats: %v", err)
		}
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "clutch-presence",
		}); err != nil {
			log.Printf("error encoding health: %v", err)
		}
	})

	port := os.Getenv("PRESENCE_PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("CLUTCH Presence Service listening on ws://localhost:%s/ws/presence", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
