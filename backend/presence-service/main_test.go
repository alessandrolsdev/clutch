package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

func TestAuthenticateRequestRejectsMissingCredential(t *testing.T) {
	t.Parallel()

	request := httptest.NewRequest(http.MethodGet, "/ws/presence?userId=attacker-id", nil)
	request.Header.Set("Origin", "http://localhost:3000")

	_, err := authenticateRequest(request, testPresenceConfig())
	if err != errMissingCredential {
		t.Fatalf("expected missing credential error, got %v", err)
	}
}

func TestAuthenticateRequestRejectsInvalidCredential(t *testing.T) {
	t.Parallel()

	request := httptest.NewRequest(http.MethodGet, "/ws/presence?token=invalid-token", nil)
	request.Header.Set("Origin", "http://localhost:3000")

	_, err := authenticateRequest(request, testPresenceConfig())
	if err != errInvalidCredential {
		t.Fatalf("expected invalid credential error, got %v", err)
	}
}

func TestPresenceHandlerRejectsDisallowedOrigin(t *testing.T) {
	t.Parallel()

	hub := newTestHub()
	server := httptest.NewServer(newPresenceHandler(hub, testPresenceConfig()))
	defer server.Close()

	_, response, err := dialPresence(
		server.URL,
		"http://malicious.example",
		tokenQuery(signTestToken(t, "user-123")),
		nil,
	)
	if err == nil {
		t.Fatal("expected websocket dial to fail for disallowed origin")
	}
	if response == nil || response.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 response, got %v", response)
	}

	assertNoRegistration(t, hub)
}

func TestPresenceHandlerRejectsMissingCredentialEvenWithUserIDQuery(t *testing.T) {
	t.Parallel()

	hub := newTestHub()
	server := httptest.NewServer(newPresenceHandler(hub, testPresenceConfig()))
	defer server.Close()

	_, response, err := dialPresence(server.URL, "http://localhost:3000", "userId=attacker-id", nil)
	if err == nil {
		t.Fatal("expected websocket dial to fail without credential")
	}
	if response == nil || response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 response, got %v", response)
	}

	assertNoRegistration(t, hub)
}

func TestPresenceHandlerRejectsInvalidCredential(t *testing.T) {
	t.Parallel()

	hub := newTestHub()
	server := httptest.NewServer(newPresenceHandler(hub, testPresenceConfig()))
	defer server.Close()

	_, response, err := dialPresence(server.URL, "http://localhost:3000", tokenQuery("invalid-token"), nil)
	if err == nil {
		t.Fatal("expected websocket dial to fail with invalid credential")
	}
	if response == nil || response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 response, got %v", response)
	}

	assertNoRegistration(t, hub)
}

func TestPresenceHandlerAuthenticatesConnectionAndUsesTokenIdentity(t *testing.T) {
	t.Parallel()

	hub := newTestHub()
	server := httptest.NewServer(newPresenceHandler(hub, testPresenceConfig()))
	defer server.Close()

	validToken := signTestToken(t, "user-123")
	connection, response, err := dialPresence(
		server.URL,
		"http://localhost:3000",
		tokenQuery(validToken)+"&userId=attacker-id",
		nil,
	)
	if err != nil {
		t.Fatalf("expected websocket dial to succeed, got status %v and error %v", response, err)
	}
	defer connection.Close()

	select {
	case registeredClient := <-hub.register:
		if registeredClient.userId != "user-123" {
			t.Fatalf("expected registered user id to come from token, got %q", registeredClient.userId)
		}
	case <-time.After(time.Second):
		t.Fatal("expected authenticated client to be registered")
	}
}

func TestPresenceHandlerAuthenticatesBearerHeader(t *testing.T) {
	t.Parallel()

	hub := newTestHub()
	server := httptest.NewServer(newPresenceHandler(hub, testPresenceConfig()))
	defer server.Close()

	headers := make(http.Header)
	headers.Set("Authorization", "Bearer "+signTestToken(t, "user-456"))

	connection, response, err := dialPresence(server.URL, "http://localhost:3000", "userId=ignored", headers)
	if err != nil {
		t.Fatalf("expected websocket dial to succeed, got status %v and error %v", response, err)
	}
	defer connection.Close()

	select {
	case registeredClient := <-hub.register:
		if registeredClient.userId != "user-456" {
			t.Fatalf("expected bearer-authenticated user id, got %q", registeredClient.userId)
		}
	case <-time.After(time.Second):
		t.Fatal("expected authenticated client to be registered")
	}
}

func testPresenceConfig() presenceConfig {
	return presenceConfig{
		jwtSecret: "test-secret",
		allowedOrigins: map[string]struct{}{
			"http://localhost:3000": {},
		},
	}
}

func newTestHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		register:   make(chan *Client, 2),
		unregister: make(chan *Client, 2),
	}
}

func signTestToken(t *testing.T, userID string) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, presenceClaims{
		ID:       userID,
		Username: "tester",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})

	signedToken, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}

	return signedToken
}

func dialPresence(serverURL string, origin string, query string, headers http.Header) (*websocket.Conn, *http.Response, error) {
	wsURL := "ws" + strings.TrimPrefix(serverURL, "http") + "/ws/presence"
	if query != "" {
		wsURL += "?" + query
	}

	requestHeaders := make(http.Header)
	for key, values := range headers {
		for _, value := range values {
			requestHeaders.Add(key, value)
		}
	}
	requestHeaders.Set("Origin", origin)

	return websocket.DefaultDialer.Dial(wsURL, requestHeaders)
}

func tokenQuery(token string) string {
	return fmt.Sprintf("token=%s", token)
}

func assertNoRegistration(t *testing.T, hub *Hub) {
	t.Helper()

	select {
	case registeredClient := <-hub.register:
		t.Fatalf("expected no registered client, got %q", registeredClient.userId)
	default:
	}
}
