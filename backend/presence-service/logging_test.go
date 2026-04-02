package main

import "testing"

func TestNewPresenceLogEntryIncludesRequiredFields(t *testing.T) {
	t.Parallel()

	entry := newPresenceLogEntry("info", "websocket_connected", "WebSocket connection opened", map[string]interface{}{
		"userId":       "user-123",
		"connectionId": "conn-123",
	})

	if entry["level"] != "info" {
		t.Fatalf("expected level info, got %v", entry["level"])
	}
	if entry["service"] != presenceServiceName {
		t.Fatalf("expected service %q, got %v", presenceServiceName, entry["service"])
	}
	if entry["event"] != "websocket_connected" {
		t.Fatalf("expected event websocket_connected, got %v", entry["event"])
	}
	if entry["message"] != "WebSocket connection opened" {
		t.Fatalf("expected message to be preserved, got %v", entry["message"])
	}
	if entry["userId"] != "user-123" {
		t.Fatalf("expected userId field, got %v", entry["userId"])
	}
	if _, ok := entry["timestamp"].(string); !ok {
		t.Fatalf("expected timestamp string, got %T", entry["timestamp"])
	}
}
