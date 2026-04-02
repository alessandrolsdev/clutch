package main

import (
	"encoding/json"
	"os"
	"time"
)

const presenceServiceName = "presence"

type logEntry map[string]interface{}

func newPresenceLogEntry(level string, event string, message string, fields map[string]interface{}) logEntry {
	entry := logEntry{
		"level":     level,
		"service":   presenceServiceName,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		"event":     event,
		"message":   message,
	}

	for key, value := range fields {
		if value == nil {
			continue
		}
		entry[key] = value
	}

	return entry
}

func writePresenceLog(level string, event string, message string, fields map[string]interface{}) {
	entry := newPresenceLogEntry(level, event, message, fields)
	encoded, err := json.Marshal(entry)
	if err != nil {
		fallback, _ := json.Marshal(logEntry{
			"level":       "error",
			"service":     presenceServiceName,
			"timestamp":   time.Now().UTC().Format(time.RFC3339Nano),
			"event":       "log_encoding_failed",
			"message":     "Failed to encode structured log entry",
			"error":       err.Error(),
			"failedEvent": event,
		})
		_, _ = os.Stderr.Write(append(fallback, '\n'))
		return
	}

	target := os.Stdout
	if level == "error" {
		target = os.Stderr
	}

	_, _ = target.Write(append(encoded, '\n'))
}

func errorFields(err error) map[string]interface{} {
	if err == nil {
		return map[string]interface{}{}
	}

	return map[string]interface{}{
		"error": err.Error(),
	}
}
