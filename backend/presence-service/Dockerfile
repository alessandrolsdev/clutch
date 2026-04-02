FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o presence-service .

FROM alpine:3.19
WORKDIR /app
RUN addgroup -S clutch && adduser -S clutch -G clutch
COPY --from=builder /app/presence-service .
RUN chown -R clutch:clutch /app
USER clutch
EXPOSE 8080
CMD ["./presence-service"]
