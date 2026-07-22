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

type Notification struct {
	ID        uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID    uint      `json:"user_id" gorm:"not null;index"`
	Title     string    `json:"title" gorm:"not null"`
	Message   string    `json:"message" gorm:"not null"`
	Type      string    `json:"type" gorm:"default:info"`
	OrderID   uint      `json:"order_id"`
	Read      bool      `json:"read" gorm:"default:false;index"`
	CreatedAt time.Time `json:"created_at"`
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
		getEnv("DB_NAME", "notificationdb"),
	)

	var err error
	for i := 0; i < 15; i++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			break
		}
		log.Printf("[Notification Service] Mencoba koneksi database... (%d/15)", i+1)
		time.Sleep(3 * time.Second)
	}

	if err != nil {
		log.Fatal("[Notification Service] Gagal koneksi database:", err)
	}

	if err := db.AutoMigrate(&Notification{}); err != nil {
		log.Fatal("[Notification Service] Gagal migrasi:", err)
	}

	log.Println("[Notification Service] Database terkoneksi")
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
		log.Printf("[Notification Service] Mencoba koneksi RabbitMQ... (%d/15)", i+1)
		time.Sleep(3 * time.Second)
	}

	if err != nil {
		log.Println("[Notification Service] Warning: Tidak dapat konek RabbitMQ:", err)
		return
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		return
	}
	defer ch.Close()

	q, err := ch.QueueDeclare(
		"notification_events_queue",
		true,  // durable
		false, // auto-delete
		false, // exclusive
		false, // no-wait
		nil,
	)
	if err != nil {
		log.Println("[Notification Service] Warning: Gagal deklarasi queue:", err)
		return
	}

	ch.Qos(1, 0, false)

	msgs, err := ch.Consume(
		q.Name,
		"notification-consumer",
		false, // manual ack
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return
	}

	log.Println("[Notification Service] Consumer RabbitMQ aktif, menunggu event...")

	for msg := range msgs {
		var event OrderEvent
		if err := json.Unmarshal(msg.Body, &event); err != nil {
			log.Println("[Notification Service] Gagal parse event:", err)
			msg.Nack(false, false)
			continue
		}

		log.Printf("[Notification Service] Menerima event: %s untuk user %d", event.Event, event.UserID)

		var title, message, notifType string
		switch event.Event {
		case "ORDER_CREATED":
			title = "✅ Pesanan Berhasil Dibuat"
			message = fmt.Sprintf(
				"Pesanan dengan nomor resi %s telah berhasil dibuat. Status saat ini: Menunggu Konfirmasi.",
				event.TrackingNumber,
			)
			notifType = "success"
		case "ORDER_STATUS_CHANGED":
			statusMap := map[string]string{
				"processing": "⚙️ Sedang Diproses",
				"shipped":    "📦 Telah Dikirim",
				"in_transit": "🚚 Dalam Perjalanan",
				"delivered":  "🎉 Telah Sampai",
				"cancelled":  "❌ Dibatalkan",
			}
			statusText, ok := statusMap[event.Status]
			if !ok {
				statusText = event.Status
			}
			title = fmt.Sprintf("Update Pesanan #%s", event.TrackingNumber)
			message = fmt.Sprintf(
				"Status pesanan %s telah diperbarui menjadi: %s",
				event.TrackingNumber, statusText,
			)
			if event.Status == "delivered" {
				notifType = "success"
			} else if event.Status == "cancelled" {
				notifType = "error"
			} else {
				notifType = "info"
			}
		default:
			msg.Ack(false)
			continue
		}

		notification := Notification{
			UserID:  event.UserID,
			Title:   title,
			Message: message,
			Type:    notifType,
			OrderID: event.OrderID,
		}

		if err := db.Create(&notification).Error; err != nil {
			log.Println("[Notification Service] Gagal simpan notifikasi:", err)
			msg.Nack(false, true)
			continue
		}

		msg.Ack(false)
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

func getNotifications(c *gin.Context) {
	userIDInterface, _ := c.Get("user_id")
	userID := userIDInterface.(uint)
	roleInterface, _ := c.Get("role")
	role := roleInterface.(string)

	var notifications []Notification
	query := db.Order("created_at DESC")

	if role != "admin" {
		query = query.Where("user_id = ?", userID)
	}

	query.Find(&notifications)

	unreadCount := int64(0)
	db.Model(&Notification{}).Where("user_id = ? AND read = false", userID).Count(&unreadCount)

	c.JSON(http.StatusOK, gin.H{
		"notifications": notifications,
		"count":         len(notifications),
		"unread_count":  unreadCount,
	})
}

func markAsRead(c *gin.Context) {
	id := c.Param("id")
	userIDInterface, _ := c.Get("user_id")
	userID := userIDInterface.(uint)

	result := db.Model(&Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("read", true)

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notifikasi tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notifikasi ditandai sudah dibaca"})
}

func markAllAsRead(c *gin.Context) {
	userIDInterface, _ := c.Get("user_id")
	userID := userIDInterface.(uint)

	db.Model(&Notification{}).
		Where("user_id = ? AND read = false", userID).
		Update("read", true)

	c.JSON(http.StatusOK, gin.H{"message": "Semua notifikasi ditandai sudah dibaca"})
}

func deleteNotification(c *gin.Context) {
	id := c.Param("id")
	userIDInterface, _ := c.Get("user_id")
	userID := userIDInterface.(uint)

	result := db.Where("id = ? AND user_id = ?", id, userID).Delete(&Notification{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notifikasi tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notifikasi berhasil dihapus"})
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "notification-service",
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

	// Start consumer goroutine
	go consumeOrderEvents()

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	r.GET("/health", healthCheck)

	api := r.Group("/api")
	api.Use(authMiddleware())
	{
		api.GET("/notifications", getNotifications)
		api.PUT("/notifications/read-all", markAllAsRead)
		api.PUT("/notifications/:id/read", markAsRead)
		api.DELETE("/notifications/:id", deleteNotification)
	}

	port := getEnv("PORT", "8004")
	log.Printf("[Notification Service] Berjalan di port %s", port)

	if err := r.Run(":" + port); err != nil {
		log.Fatal("[Notification Service] Gagal menjalankan server:", err)
	}
}
