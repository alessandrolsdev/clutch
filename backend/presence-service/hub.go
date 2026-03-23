package main

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// ─────────────────────────────────────────────────────────────
// Hub — gerencia todas as conexões WebSocket ativas
// ─────────────────────────────────────────────────────────────

type WsEvent string

const (
	EventFriendPresence WsEvent = "FRIEND_PRESENCE"
	EventPong           WsEvent = "PONG"
	EventNotification   WsEvent = "NOTIFICATION"
)

type WsMessage struct {
	Event   WsEvent     `json:"event"`
	Payload interface{} `json:"payload"`
	Ts      int64       `json:"ts"`
}

type PresenceUpdate struct {
	UserId      string  `json:"userId"`
	Status      string  `json:"status"`
	CurrentGame *string `json:"currentGame"`
	Platform    *string `json:"platform"`
}

type Hub struct {
	mu          sync.RWMutex
	clients     map[string]*Client // userId → Client
	register    chan *Client
	unregister  chan *Client
	redisClient *redis.Client
}

func NewHub(redisClient *redis.Client) *Hub {
	return &Hub{
		clients:     make(map[string]*Client),
		register:    make(chan *Client, 256),
		unregister:  make(chan *Client, 256),
		redisClient: redisClient,
	}
}

func (h *Hub) Run(ctx context.Context) {
	// Subscreve no canal de presença do Redis
	pubsub := h.redisClient.Subscribe(ctx, "presence:updates")
	defer func() {
		if err := pubsub.Close(); err != nil {
			log.Printf("error closing pubsub: %v", err)
		}
	}()

	redisCh := pubsub.Channel()

	for {
		select {
		case <-ctx.Done():
			return

		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.userId] = client
			h.mu.Unlock()
			log.Printf("client registered: %s (total: %d)", client.userId, h.Count())

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.userId]; ok {
				delete(h.clients, client.userId)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("client unregistered: %s (total: %d)", client.userId, h.Count())

		case msg := <-redisCh:
			h.broadcastPresenceUpdate(msg.Payload)
		}
	}
}

func (h *Hub) broadcastPresenceUpdate(payload string) {
	var update PresenceUpdate
	if err := json.Unmarshal([]byte(payload), &update); err != nil {
		log.Printf("error parsing presence update: %v", err)
		return
	}

	msg := WsMessage{
		Event:   EventFriendPresence,
		Payload: update,
		Ts:      time.Now().UnixMilli(),
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("error marshaling message: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	// Entrega para todos os clientes conectados exceto o próprio usuário
	for userId, client := range h.clients {
		if userId == update.UserId {
			continue
		}
		select {
		case client.send <- data:
		default:
			// Canal cheio — cliente lento, será desconectado
			close(client.send)
			delete(h.clients, userId)
		}
	}
}

func (h *Hub) Count() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}