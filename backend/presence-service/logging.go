package main

import (
	"encoding/json"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"
)

const presenceServiceName = "presence"

type logEntry map[string]interface{}

type sanitizedConnectionTarget struct {
	Scheme      string
	Host        string
	Port        string
}

var sensitiveURLPattern = regexp.MustCompile(`[A-Za-z][A-Za-z0-9+.-]*://[^\s"'<>]+`)

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
		"error": sanitizeSensitiveText(err.Error()),
	}
}

func sanitizeConnectionURL(rawURL string) sanitizedConnectionTarget {
	trimmedURL := strings.TrimSpace(rawURL)
	if trimmedURL == "" {
		return sanitizedConnectionTarget{}
	}

	parsedURL, err := url.Parse(trimmedURL)
	if err != nil {
		return parseConnectionTargetFallback(trimmedURL)
	}

	return sanitizedConnectionTarget{
		Scheme: parsedURL.Scheme,
		Host:   parsedURL.Hostname(),
		Port:   parsedURL.Port(),
	}
}

func parseConnectionTargetFallback(rawURL string) sanitizedConnectionTarget {
	schemeSeparatorIndex := strings.Index(rawURL, "://")
	if schemeSeparatorIndex < 0 {
		return sanitizedConnectionTarget{}
	}

	scheme := rawURL[:schemeSeparatorIndex]
	remainder := rawURL[schemeSeparatorIndex+3:]
	atIndex := strings.LastIndex(remainder, "@")
	hostAndPath := remainder
	if atIndex >= 0 {
		hostAndPath = remainder[atIndex+1:]
	}

	slashIndex := strings.Index(hostAndPath, "/")
	hostPort := hostAndPath
	if slashIndex >= 0 {
		hostPort = hostAndPath[:slashIndex]
	}

	colonIndex := strings.LastIndex(hostPort, ":")
	if colonIndex < 0 {
		return sanitizedConnectionTarget{
			Scheme: scheme,
			Host:   hostPort,
		}
	}

	return sanitizedConnectionTarget{
		Scheme: scheme,
		Host:   hostPort[:colonIndex],
		Port:   hostPort[colonIndex+1:],
	}
}

func formatSanitizedConnectionTarget(target sanitizedConnectionTarget) string {
	parts := make([]string, 0, 3)
	if target.Scheme != "" {
		parts = append(parts, "scheme="+target.Scheme)
	}
	if target.Host != "" {
		parts = append(parts, "host="+target.Host)
	}
	if target.Port != "" {
		parts = append(parts, "port="+target.Port)
	}

	if len(parts) == 0 {
		return "[connection redacted]"
	}

	return "[connection " + strings.Join(parts, " ") + "]"
}

func connectionLogFields(prefix string, rawURL string, status string) map[string]interface{} {
	fields := map[string]interface{}{
		"status": status,
	}

	target := sanitizeConnectionURL(rawURL)
	if target.Scheme != "" {
		fields[prefix+"Scheme"] = target.Scheme
	}
	if target.Host != "" {
		fields[prefix+"Host"] = target.Host
	}
	if target.Port != "" {
		fields[prefix+"Port"] = target.Port
	}

	return fields
}

func sanitizeSensitiveText(value string) string {
	if strings.TrimSpace(value) == "" {
		return value
	}

	return sensitiveURLPattern.ReplaceAllStringFunc(value, func(match string) string {
		return formatSanitizedConnectionTarget(sanitizeConnectionURL(match))
	})
}
