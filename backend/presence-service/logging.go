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
	RedactedURL string
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
		return sanitizedConnectionTarget{
			RedactedURL: redactConnectionURLFallback(trimmedURL),
		}
	}

	redactedURL := parsedURL.String()
	if parsedURL.User != nil {
		username := parsedURL.User.Username()
		if _, hasPassword := parsedURL.User.Password(); hasPassword {
			redactedURL = buildRedactedURL(parsedURL, username)
		}
	}

	return sanitizedConnectionTarget{
		Scheme:      parsedURL.Scheme,
		Host:        parsedURL.Hostname(),
		Port:        parsedURL.Port(),
		RedactedURL: redactedURL,
	}
}

func buildRedactedURL(parsedURL *url.URL, username string) string {
	var builder strings.Builder

	if parsedURL.Scheme != "" {
		builder.WriteString(parsedURL.Scheme)
		builder.WriteString("://")
	}

	if username != "" {
		builder.WriteString(username)
	}
	builder.WriteString(":***@")
	builder.WriteString(parsedURL.Host)

	if parsedURL.RawPath != "" {
		builder.WriteString(parsedURL.RawPath)
	} else {
		builder.WriteString(parsedURL.EscapedPath())
	}

	if parsedURL.RawQuery != "" {
		builder.WriteString("?")
		builder.WriteString(parsedURL.RawQuery)
	}

	if parsedURL.Fragment != "" {
		builder.WriteString("#")
		builder.WriteString(parsedURL.Fragment)
	}

	return builder.String()
}

func redactConnectionURLFallback(rawURL string) string {
	schemeSeparatorIndex := strings.Index(rawURL, "://")
	if schemeSeparatorIndex < 0 {
		return rawURL
	}

	scheme := rawURL[:schemeSeparatorIndex+3]
	remainder := rawURL[schemeSeparatorIndex+3:]
	atIndex := strings.LastIndex(remainder, "@")
	if atIndex < 0 {
		return rawURL
	}

	userInfo := remainder[:atIndex]
	hostAndPath := remainder[atIndex+1:]

	colonIndex := strings.Index(userInfo, ":")
	if colonIndex < 0 {
		return rawURL
	}

	username := userInfo[:colonIndex]
	return scheme + username + ":***@" + hostAndPath
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
	if target.RedactedURL != "" && target.Host == "" {
		fields[prefix+"UrlRedacted"] = target.RedactedURL
	}

	return fields
}

func sanitizeSensitiveText(value string) string {
	if strings.TrimSpace(value) == "" {
		return value
	}

	return sensitiveURLPattern.ReplaceAllStringFunc(value, func(match string) string {
		target := sanitizeConnectionURL(match)
		if target.RedactedURL == "" {
			return match
		}
		return target.RedactedURL
	})
}
