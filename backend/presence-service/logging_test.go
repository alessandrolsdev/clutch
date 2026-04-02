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

func TestSanitizeConnectionURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		rawURL         string
		wantRedacted   string
		wantScheme     string
		wantHost       string
		wantPort       string
	}{
		{
			name:         "masks password while preserving host and port",
			rawURL:       "redis://default:super-secret@redis.internal:6379/0",
			wantRedacted: "redis://default:***@redis.internal:6379/0",
			wantScheme:   "redis",
			wantHost:     "redis.internal",
			wantPort:     "6379",
		},
		{
			name:         "preserves url without password",
			rawURL:       "redis://redis.internal:6379/0",
			wantRedacted: "redis://redis.internal:6379/0",
			wantScheme:   "redis",
			wantHost:     "redis.internal",
			wantPort:     "6379",
		},
		{
			name:         "redacts invalid url without panicking",
			rawURL:       "redis://default:super-secret@%zz:6379",
			wantRedacted: "redis://default:***@%zz:6379",
		},
	}

	for _, tt := range tests {
		tt := tt

		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			target := sanitizeConnectionURL(tt.rawURL)

			if target.RedactedURL != tt.wantRedacted {
				t.Fatalf("expected redacted url %q, got %q", tt.wantRedacted, target.RedactedURL)
			}
			if target.Scheme != tt.wantScheme {
				t.Fatalf("expected scheme %q, got %q", tt.wantScheme, target.Scheme)
			}
			if target.Host != tt.wantHost {
				t.Fatalf("expected host %q, got %q", tt.wantHost, target.Host)
			}
			if target.Port != tt.wantPort {
				t.Fatalf("expected port %q, got %q", tt.wantPort, target.Port)
			}
		})
	}
}

func TestConnectionLogFields(t *testing.T) {
	t.Parallel()

	t.Run("uses host and port for valid urls", func(t *testing.T) {
		t.Parallel()

		fields := connectionLogFields("redis", "redis://default:super-secret@redis.internal:6379/0", "connected")

		if fields["status"] != "connected" {
			t.Fatalf("expected status connected, got %v", fields["status"])
		}
		if fields["redisHost"] != "redis.internal" {
			t.Fatalf("expected redisHost redis.internal, got %v", fields["redisHost"])
		}
		if fields["redisPort"] != "6379" {
			t.Fatalf("expected redisPort 6379, got %v", fields["redisPort"])
		}
		if _, ok := fields["redisUrl"]; ok {
			t.Fatalf("did not expect redisUrl for valid connection target")
		}
		if _, ok := fields["redisUrlRedacted"]; ok {
			t.Fatalf("did not expect redisUrlRedacted for valid connection target")
		}
	})

	t.Run("falls back to redacted url for invalid urls", func(t *testing.T) {
		t.Parallel()

		fields := connectionLogFields("redis", "redis://default:super-secret@%zz:6379", "parse_failed")

		if fields["status"] != "parse_failed" {
			t.Fatalf("expected status parse_failed, got %v", fields["status"])
		}
		if fields["redisUrlRedacted"] != "redis://default:***@%zz:6379" {
			t.Fatalf("expected redisUrlRedacted to be masked, got %v", fields["redisUrlRedacted"])
		}
		if _, ok := fields["redisHost"]; ok {
			t.Fatalf("did not expect redisHost for invalid connection target")
		}
		if _, ok := fields["redisPort"]; ok {
			t.Fatalf("did not expect redisPort for invalid connection target")
		}
	})
}

func TestSanitizeSensitiveText(t *testing.T) {
	t.Parallel()

	t.Run("redacts credentials inside error messages", func(t *testing.T) {
		t.Parallel()

		sanitized := sanitizeSensitiveText(`parse "redis://default:super-secret@%zz:6379": invalid URL escape "%zz"`)

		if sanitized != `parse "redis://default:***@%zz:6379": invalid URL escape "%zz"` {
			t.Fatalf("expected sanitized error string, got %q", sanitized)
		}
	})

	t.Run("preserves urls without passwords", func(t *testing.T) {
		t.Parallel()

		sanitized := sanitizeSensitiveText(`connected to redis://redis.internal:6379/0`)

		if sanitized != `connected to redis://redis.internal:6379/0` {
			t.Fatalf("expected url without password to stay unchanged, got %q", sanitized)
		}
	})
}
