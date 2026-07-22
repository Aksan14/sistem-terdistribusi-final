package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	amqp "github.com/rabbitmq/amqp091-go"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// ============================================================
// MODELS
// ============================================================

type TrackingEvent struct {
	ID          uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	OrderID     uint      `json:"order_id" gorm:"not null;index"`
	Status      string    `json:"status" gorm:"not null"`
	Location    string    `json:"location"`
	Description string    `json:"description"`
	CreatedBy   string    `json:"created_by" gorm:"default:system"`
	CreatedAt   time.Time `json:"created_at"`
}

// ============================================================
// RABBITMQ EVENT
// ============================================================

type OrderEvent struct {
	Event          string    `json:"event"`
	OrderID        uint      `json:"order_id"`
	UserID         uint      `json:"user_id"`
	TrackingNumber string    `json:"tracking_number"`
	Status         string    `json:"status"`
	SenderCity     string    `json:"sender_city"`
	ReceiverCity   string    `json:"receiver_city"`
	Timestamp      time.Time `json:"timestamp"`
}

// ============================================================
// REQUEST
// ============================================================

type AddTrackingRequest struct {
	OrderID     uint   `json:"order_id" binding:"required"`
	Status      string `json:"status" binding:"required"`
	Location    string `json:"location"`
	Description string `json:"description"`
}

// ============================================================
// JWT
// ============================================================

type Claims struct {
	UserID uint   `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

var (
	db        *gorm.DB
	jwtSecret []byte
)

// ============================================================
// DATABASE
// ============================================================

func initDB() {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable TimeZone=Asia/Jakarta",
		getEnv("DB_HOST", "localhost"),
		getEnv("DB_PORT", "5432"),
		getEnv("DB_USER", "postgres"),
		getEnv("DB_PASSWORD", "postgres123"),
		getEnv("DB_NAME", "trackingdb"),
	)

	var err error
	for i := 0; i < 15; i++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			break
		}
		log.Printf("[Tracking Service] Mencoba koneksi database... (%d/15)", i+1)
		time.Sleep(3 * time.Second)
	}

	if err != nil {
		log.Fatal("[Tracking Service] Gagal koneksi database:", err)
	}

	if err := db.AutoMigrate(&TrackingEvent{}); err != nil {
		log.Fatal("[Tracking Service] Gagal migrasi:", err)
	}

	log.Println("[Tracking Service] Database terkoneksi")
}

// ============================================================
// RABBITMQ CONSUMER
// ============================================================

func consumeOrderEvents() {
	rabbitmqURL := getEnv("RABBITMQ_URL", "amqp://admin:admin123@localhost:5672/")

	var conn *amqp.Connection
	var err error
	for i := 0; i < 15; i++ {
		conn, err = amqp.Dial(rabbitmqURL)
		if err == nil {
			break
		}
		log.Printf("[Tracking Service] Mencoba koneksi RabbitMQ... (%d/15)", i+1)
		time.Sleep(3 * time.Second)
	}

	if err != nil {
		log.Println("[Tracking Service] Warning: Tidak dapat konek RabbitMQ:", err)
		return
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		log.Println("[Tracking Service] Warning: Gagal buat channel:", err)
		return
	}
	defer ch.Close()

	q, err := ch.QueueDeclare(
		"tracking_events_queue",
		true,  // durable
		false, // auto-delete
		false, // exclusive
		false, // no-wait
		nil,
	)
	if err != nil {
		log.Println("[Tracking Service] Warning: Gagal deklarasi queue:", err)
		return
	}

	// Prefetch 1 message at a time
	ch.Qos(1, 0, false)

	msgs, err := ch.Consume(
		q.Name,
		"tracking-consumer",
		false, // manual ack
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Println("[Tracking Service] Warning: Gagal register consumer:", err)
		return
	}

	log.Println("[Tracking Service] Consumer RabbitMQ aktif, menunggu event...")

	for msg := range msgs {
		var event OrderEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			log.Println("[Tracking Service] Gagal parse event:", err)
			msg.Nack(false, false)
			continue
		}

		log.Printf("[Tracking Service] Menerima event: %s untuk order %d", event.Event, event.OrderID)

		// Buat tracking event otomatis
		trackingEvent := TrackingEvent{
			OrderID:     event.OrderID,
			Status:      event.Status,
			Location:    getLocationByStatus(event.Status, event.SenderCity, event.ReceiverCity),
			Description: getStatusDescription(event.Status),
			CreatedBy:   "system",
		}

		if err := db.Create(&trackingEvent).Error; err != nil {
			log.Println("[Tracking Service] Gagal simpan tracking event:", err)
			msg.Nack(false, true) // requeue
			continue
		}

		msg.Ack(false)
	}
}

func getStatusDescription(status string) string {
	descriptions := map[string]string{
		"pending":    "Pesanan diterima, menunggu konfirmasi",
		"processing": "Pesanan sedang diproses dan dikemas",
		"shipped":    "Paket telah diserahkan ke kurir",
		"in_transit": "Paket sedang dalam perjalanan",
		"delivered":  "Paket telah berhasil diterima",
		"cancelled":  "Pesanan dibatalkan",
	}
	if desc, ok := descriptions[status]; ok {
		return desc
	}
	return "Status pesanan diperbarui"
}

func getLocationByStatus(status, senderCity, receiverCity string) string {
	switch status {
	case "pending", "processing":
		return senderCity
	case "shipped":
		return fmt.Sprintf("Gudang %s", senderCity)
	case "in_transit":
		return fmt.Sprintf("Dalam perjalanan menuju %s", receiverCity)
	case "delivered":
		return receiverCity
	default:
		return senderCity
	}
}

// ============================================================
// MIDDLEWARE
// ============================================================

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header diperlukan"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid"})
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// ============================================================
// HANDLERS
// ============================================================

func addTrackingEvent(c *gin.Context) {
	roleInterface, _ := c.Get("role")
	role := roleInterface.(string)

	if role != "admin" && role != "courier" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak"})
		return
	}

	var req AddTrackingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	emailInterface, _ := c.Get("email")
	email := emailInterface.(string)

	event := TrackingEvent{
		OrderID:     req.OrderID,
		Status:      req.Status,
		Location:    req.Location,
		Description: req.Description,
		CreatedBy:   email,
	}

	if err := db.Create(&event).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menambah tracking event"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Tracking event berhasil ditambahkan",
		"event":   event,
	})
}

func getTracking(c *gin.Context) {
	orderID := c.Param("order_id")

	var events []TrackingEvent
	if err := db.Where("order_id = ?", orderID).Order("created_at ASC").Find(&events).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data tracking"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"order_id": orderID,
		"events":   events,
		"count":    len(events),
	})
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "tracking-service",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// ============================================================
// MAIN
// ============================================================

func main() {
	jwtSecret = []byte(getEnv("JWT_SECRET", "default-secret-key"))

	initDB()

	// Start RabbitMQ consumer in background goroutine
	go consumeOrderEvents()

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// Public routes
	r.GET("/health", healthCheck)
	r.GET("/tracking/:order_id", getTracking) // Public tracking

	// Protected routes
	api := r.Group("/api")
	api.Use(authMiddleware())
	{
		api.POST("/tracking", addTrackingEvent)
		api.GET("/tracking/:order_id", getTracking)
	}

	port := getEnv("PORT", "8003")
	log.Printf("[Tracking Service] Berjalan di port %s", port)

	if err := r.Run(":" + port); err != nil {
		log.Fatal("[Tracking Service] Gagal menjalankan server:", err)
	}
}
