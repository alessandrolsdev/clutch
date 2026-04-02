package main

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

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

type NotificationPayload struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Payload   map[string]interface{} `json:"payload"`
	ActorID   *string                `json:"actorId"`
	IsRead    bool                   `json:"isRead"`
	CreatedAt string                 `json:"createdAt"`
}

const (
	presenceChannelPrefix      = "realtime:presence:"
	notificationsChannelPrefix = "notifications:"
)

type Hub struct {
	mu          sync.RWMutex
	clients     map[string]*Client
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
	pubsub := h.redisClient.PSubscribe(ctx, presenceChannelPrefix+"*", notificationsChannelPrefix+"*")
	defer func() {
		if err := pubsub.Close(); err != nil {
			writePresenceLog("error", "redis_pubsub_close_failed", "Failed to close Redis pubsub", errorFields(err))
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
			writePresenceLog("info", "websocket_client_registered", "WebSocket client registered", map[string]interface{}{
				"userId":       client.userId,
				"connectionId": client.connectionId,
				"connections":  h.Count(),
			})

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.userId]; ok {
				delete(h.clients, client.userId)
				close(client.send)
			}
			h.mu.Unlock()
			writePresenceLog("info", "websocket_client_unregistered", "WebSocket client unregistered", map[string]interface{}{
				"userId":       client.userId,
				"connectionId": client.connectionId,
				"connections":  h.Count(),
			})

		case msg := <-redisCh:
			h.routeRealtimeMessage(msg.Channel, msg.Payload)
		}
	}
}

func (h *Hub) routeRealtimeMessage(channel string, payload string) {
	switch {
	case strings.HasPrefix(channel, presenceChannelPrefix):
		h.deliverPresenceUpdate(channel, payload)
	case strings.HasPrefix(channel, notificationsChannelPrefix):
		h.deliverNotification(channel, payload)
	default:
		writePresenceLog("warn", "redis_channel_unsupported", "Unsupported realtime channel received", map[string]interface{}{
			"channel": channel,
		})
	}
}

func (h *Hub) deliverPresenceUpdate(channel string, payload string) {
	recipientID, ok := channelRecipientID(channel, presenceChannelPrefix)
	if !ok {
		writePresenceLog("warn", "presence_channel_invalid", "Invalid presence channel received", map[string]interface{}{
			"channel": channel,
		})
		return
	}

	var message WsMessage
	if err := json.Unmarshal([]byte(payload), &message); err != nil {
		fields := errorFields(err)
		fields["channel"] = channel
		writePresenceLog("error", "presence_payload_parse_failed", "Failed to parse presence update payload", fields)
		return
	}

	if message.Event != EventFriendPresence {
		writePresenceLog("warn", "presence_event_unexpected", "Unexpected presence event received", map[string]interface{}{
			"channel": channel,
			"event":   string(message.Event),
		})
		return
	}

	data, err := json.Marshal(message)
	if err != nil {
		fields := errorFields(err)
		fields["channel"] = channel
		writePresenceLog("error", "presence_payload_marshal_failed", "Failed to marshal presence message", fields)
		return
	}

	h.sendToUser(recipientID, data)
}

func (h *Hub) deliverNotification(channel string, payload string) {
	recipientID, ok := channelRecipientID(channel, notificationsChannelPrefix)
	if !ok {
		writePresenceLog("warn", "notification_channel_invalid", "Invalid notification channel received", map[string]interface{}{
			"channel": channel,
		})
		return
	}

	var notification NotificationPayload
	if err := json.Unmarshal([]byte(payload), &notification); err != nil {
		fields := errorFields(err)
		fields["channel"] = channel
		writePresenceLog("error", "notification_payload_parse_failed", "Failed to parse notification payload", fields)
		return
	}

	message := WsMessage{
		Event:   EventNotification,
		Payload: notification,
		Ts:      time.Now().UnixMilli(),
	}

	data, err := json.Marshal(message)
	if err != nil {
		fields := errorFields(err)
		fields["channel"] = channel
		writePresenceLog("error", "notification_payload_marshal_failed", "Failed to marshal notification message", fields)
		return
	}

	h.sendToUser(recipientID, data)
}

func channelRecipientID(channel string, prefix string) (string, bool) {
	if !strings.HasPrefix(channel, prefix) {
		return "", false
	}

	recipientID := strings.TrimPrefix(channel, prefix)
	if recipientID == "" {
		return "", false
	}

	return recipientID, true
}

func (h *Hub) sendToUser(userID string, data []byte) {
	h.mu.RLock()
	client, ok := h.clients[userID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	select {
	case client.send <- data:
	default:
		h.mu.Lock()
		if currentClient, exists := h.clients[userID]; exists && currentClient == client {
			close(client.send)
			delete(h.clients, userID)
		}
		h.mu.Unlock()
		writePresenceLog("warn", "websocket_client_dropped", "Dropped slow websocket client", map[string]interface{}{
			"userId":       userID,
			"connectionId": client.connectionId,
		})
	}
}

func (h *Hub) Count() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
