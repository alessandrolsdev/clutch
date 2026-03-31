package main

import (
	"encoding/json"
	"testing"
	"time"
)

func TestDeliverPresenceUpdateSendsOnlyToRecipient(t *testing.T) {
	t.Parallel()

	hub := &Hub{
		clients: map[string]*Client{
			"friend-id-1": {userId: "friend-id-1", send: make(chan []byte, 1)},
			"friend-id-2": {userId: "friend-id-2", send: make(chan []byte, 1)},
		},
	}

	message, err := json.Marshal(WsMessage{
		Event: EventFriendPresence,
		Payload: PresenceUpdate{
			UserId: "user-id-1",
			Status: "ONLINE",
		},
		Ts: time.Now().UnixMilli(),
	})
	if err != nil {
		t.Fatalf("failed to marshal presence message: %v", err)
	}

	hub.deliverPresenceUpdate("realtime:presence:friend-id-1", string(message))

	assertMessageDelivered(t, hub.clients["friend-id-1"].send)
	assertNoMessageDelivered(t, hub.clients["friend-id-2"].send)
}

func TestDeliverNotificationSendsOnlyToRecipient(t *testing.T) {
	t.Parallel()

	hub := &Hub{
		clients: map[string]*Client{
			"user-id-1": {userId: "user-id-1", send: make(chan []byte, 1)},
			"user-id-2": {userId: "user-id-2", send: make(chan []byte, 1)},
		},
	}

	payload, err := json.Marshal(NotificationPayload{
		ID:      "notif-id-1",
		Type:    "FRIEND_REQUEST",
		Payload: map[string]interface{}{"requestId": "request-id-1"},
		IsRead:  false,
	})
	if err != nil {
		t.Fatalf("failed to marshal notification payload: %v", err)
	}

	hub.deliverNotification("notifications:user-id-1", string(payload))

	assertMessageDelivered(t, hub.clients["user-id-1"].send)
	assertNoMessageDelivered(t, hub.clients["user-id-2"].send)
}

func TestChannelRecipientIDRejectsInvalidChannel(t *testing.T) {
	t.Parallel()

	if _, ok := channelRecipientID("presence:updates", presenceChannelPrefix); ok {
		t.Fatal("expected invalid channel to be rejected")
	}
}

func assertMessageDelivered(t *testing.T, messages <-chan []byte) {
	t.Helper()

	select {
	case <-messages:
	case <-time.After(time.Second):
		t.Fatal("expected message to be delivered")
	}
}

func assertNoMessageDelivered(t *testing.T, messages <-chan []byte) {
	t.Helper()

	select {
	case message := <-messages:
		t.Fatalf("expected no message, received %s", string(message))
	default:
	}
}
