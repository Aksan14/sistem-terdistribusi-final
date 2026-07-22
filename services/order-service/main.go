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

type Order struct {
	ID              uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID          uint      `json:"user_id" gorm:"not null;index"`
	TrackingNumber  string    `json:"tracking_number" gorm:"uniqueIndex;not null"`
	SenderName      string    `json:"sender_name" gorm:"not null"`
	SenderPhone     string    `json:"sender_phone"`
	SenderAddress   string    `json:"sender_address" gorm:"not null"`
	SenderCity      string    `json:"sender_city"`
	ReceiverName    string    `json:"receiver_name" gorm:"not null"`
	ReceiverPhone   string    `json:"receiver_phone"`
	ReceiverAddress string    `json:"receiver_address" gorm:"not null"`
	ReceiverCity    string    `json:"receiver_city"`
	Weight          float64   `json:"weight" gorm:"not null"`
	Description     string    `json:"description"`
	Status          string    `json:"status" gorm:"default:pending;index"`
	Price           float64   `json:"price"`
	ServiceType     string    `json:"service_type" gorm:"default:regular"`
	Notes           string    `json:"notes"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// ============================================================
// MESSAGE BROKER EVENTS
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
// REQUEST / RESPONSE
// ============================================================

type CreateOrderRequest struct {
	SenderName      string  `json:"sender_name" binding:"required"`
	SenderPhone     string  `json:"sender_phone"`
	SenderAddress   string  `json:"sender_address" binding:"required"`
	SenderCity      string  `json:"sender_city" binding:"required"`
	ReceiverName    string  `json:"receiver_name" binding:"required"`
	ReceiverPhone   string  `json:"receiver_phone"`
	ReceiverAddress string  `json:"receiver_address" binding:"required"`
	ReceiverCity    string  `json:"receiver_city" binding:"required"`
	Weight          float64 `json:"weight" binding:"required,gt=0"`
	Description     string  `json:"description"`
	ServiceType     string  `json:"service_type"`
	Notes           string  `json:"notes"`
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"`
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
	mqConn    *amqp.Connection
	mqChannel *amqp.Channel
	jwtSecret []byte
)

// ============================================================
// RABBITMQ
// ============================================================

func initRabbitMQ() {
	rabbitmqURL := getEnv("RABBITMQ_URL", "amqp://admin:admin123@localhost:5672/")

	var err error
	for i := 0; i < 15; i++ {
		mqConn, err = amqp.Dial(rabbitmqURL)
		if err == nil {
			break
		}
		log.Printf("[Order Service] Mencoba koneksi RabbitMQ... (%d/15)", i+1)
		time.Sleep(3 * time.Second)
	}

	if err != nil {
		log.Println("[Order Service] Warning: Tidak dapat konek ke RabbitMQ:", err)
		return
	}

	mqChannel, err = mqConn.Channel()
	if err != nil {
		log.Println("[Order Service] Warning: Tidak dapat membuat channel:", err)
		return
	}

	// Declare queues untuk tracking dan notification
	queues := []string{"tracking_events_queue", "notification_events_queue"}
	for _, qName := range queues {
		_, err = mqChannel.QueueDeclare(qName, true, false, false, false, nil)
		if err != nil {
			log.Printf("[Order Service] Warning: Gagal deklarasi queue %s: %v", qName, err)
		}
	}

	log.Println("[Order Service] RabbitMQ terkoneksi")
}

func publishEvent(event OrderEvent) {
	if mqChannel == nil {
		return
	}

	body, err := json.Marshal(event)
	if err != nil {
		log.Println("[Order Service] Gagal marshal event:", err)
		return
	}

	// Publish ke tracking queue
	if err := mqChannel.Publish("", "tracking_events_queue", false, false, amqp.Publishing{
		ContentType:  "application/json",
		Body:         body,
		DeliveryMode: amqp.Persistent,
	}); err != nil {
		log.Println("[Order Service] Gagal publish ke tracking queue:", err)
	}

	// Publish ke notification queue
	if err := mqChannel.Publish("", "notification_events_queue", false, false, amqp.Publishing{
		ContentType:  "application/json",
		Body:         body,
		DeliveryMode: amqp.Persistent,
	}); err != nil {
		log.Println("[Order Service] Gagal publish ke notification queue:", err)
	}
}

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
		getEnv("DB_NAME", "orderdb"),
	)

	var err error
	for i := 0; i < 15; i++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			break
		}
		log.Printf("[Order Service] Mencoba koneksi database... (%d/15)", i+1)
		time.Sleep(3 * time.Second)
	}

	if err != nil {
		log.Fatal("[Order Service] Gagal koneksi database:", err)
	}

	if err := db.AutoMigrate(&Order{}); err != nil {
		log.Fatal("[Order Service] Gagal migrasi:", err)
	}

	log.Println("[Order Service] Database terkoneksi dan dimigrasikan")
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
// HELPERS
// ============================================================

func generateTrackingNumber() string {
	timestamp := time.Now().UnixNano() / 1000000
	return fmt.Sprintf("EXP%d", timestamp)
}

func calculatePrice(weight float64, serviceType string) float64 {
	// Harga dasar per 100 gram
	basePrice := (weight / 100) * 5000
	if basePrice < 10000 {
		basePrice = 10000 // Minimum harga
	}
	switch serviceType {
	case "express":
		return basePrice * 2.5
	case "same_day":
		return basePrice * 4.0
	case "economy":
		return basePrice * 0.8
	default: // regular
		return basePrice
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// ============================================================
// HANDLERS
// ============================================================

func createOrder(c *gin.Context) {
	userIDInterface, _ := c.Get("user_id")
	userID := userIDInterface.(uint)

	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	serviceType := req.ServiceType
	if serviceType == "" {
		serviceType = "regular"
	}

	order := Order{
		UserID:          userID,
		TrackingNumber:  generateTrackingNumber(),
		SenderName:      req.SenderName,
		SenderPhone:     req.SenderPhone,
		SenderAddress:   req.SenderAddress,
		SenderCity:      req.SenderCity,
		ReceiverName:    req.ReceiverName,
		ReceiverPhone:   req.ReceiverPhone,
		ReceiverAddress: req.ReceiverAddress,
		ReceiverCity:    req.ReceiverCity,
		Weight:          req.Weight,
		Description:     req.Description,
		Status:          "pending",
		Price:           calculatePrice(req.Weight, serviceType),
		ServiceType:     serviceType,
		Notes:           req.Notes,
	}

	if err := db.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat pesanan"})
		return
	}

	// Publish event ke message broker
	go publishEvent(OrderEvent{
		Event:          "ORDER_CREATED",
		OrderID:        order.ID,
		UserID:         userID,
		TrackingNumber: order.TrackingNumber,
		Status:         order.Status,
		SenderCity:     order.SenderCity,
		ReceiverCity:   order.ReceiverCity,
		Timestamp:      time.Now(),
	})

	c.JSON(http.StatusCreated, gin.H{
		"message": "Pesanan berhasil dibuat",
		"order":   order,
	})
}

func getOrders(c *gin.Context) {
	userIDInterface, _ := c.Get("user_id")
	userID := userIDInterface.(uint)
	roleInterface, _ := c.Get("role")
	role := roleInterface.(string)

	var orders []Order
	query := db.Order("created_at DESC")

	if role != "admin" {
		query = query.Where("user_id = ?", userID)
	}

	// Filter by status if provided
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data pesanan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"orders": orders,
		"count":  len(orders),
	})
}

func getOrder(c *gin.Context) {
	id := c.Param("id")
	userIDInterface, _ := c.Get("user_id")
	userID := userIDInterface.(uint)
	roleInterface, _ := c.Get("role")
	role := roleInterface.(string)

	var order Order
	query := db.Where("id = ?", id)
	if role != "admin" {
		query = query.Where("user_id = ?", userID)
	}

	if err := query.First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pesanan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, order)
}

func getOrderByTracking(c *gin.Context) {
	trackingNumber := c.Param("tracking")

	var order Order
	if err := db.Where("tracking_number = ?", trackingNumber).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pesanan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, order)
}

func updateOrderStatus(c *gin.Context) {
	id := c.Param("id")
	roleInterface, _ := c.Get("role")
	role := roleInterface.(string)

	if role != "admin" && role != "courier" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak"})
		return
	}

	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	validStatuses := map[string]bool{
		"pending": true, "processing": true, "shipped": true,
		"in_transit": true, "delivered": true, "cancelled": true,
	}
	if !validStatuses[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status tidak valid"})
		return
	}

	var order Order
	if err := db.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pesanan tidak ditemukan"})
		return
	}

	order.Status = req.Status
	db.Save(&order)

	// Publish event
	go publishEvent(OrderEvent{
		Event:          "ORDER_STATUS_CHANGED",
		OrderID:        order.ID,
		UserID:         order.UserID,
		TrackingNumber: order.TrackingNumber,
		Status:         req.Status,
		SenderCity:     order.SenderCity,
		ReceiverCity:   order.ReceiverCity,
		Timestamp:      time.Now(),
	})

	c.JSON(http.StatusOK, gin.H{
		"message": "Status pesanan diperbarui",
		"order":   order,
	})
}

func deleteOrder(c *gin.Context) {
	id := c.Param("id")
	userIDInterface, _ := c.Get("user_id")
	userID := userIDInterface.(uint)
	roleInterface, _ := c.Get("role")
	role := roleInterface.(string)

	var order Order
	query := db.Where("id = ?", id)
	if role != "admin" {
		query = query.Where("user_id = ?", userID)
	}

	if err := query.First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pesanan tidak ditemukan"})
		return
	}

	if order.Status != "pending" && role != "admin" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pesanan yang sudah diproses tidak dapat dihapus"})
		return
	}

	db.Delete(&order)
	c.JSON(http.StatusOK, gin.H{"message": "Pesanan berhasil dihapus"})
}

func getOrderStats(c *gin.Context) {
	roleInterface, _ := c.Get("role")
	role := roleInterface.(string)
	userIDInterface, _ := c.Get("user_id")
	userID := userIDInterface.(uint)

	type StatusCount struct {
		Status string
		Count  int64
	}

	var results []StatusCount
	query := db.Model(&Order{}).Select("status, count(*) as count").Group("status")

	if role != "admin" {
		query = query.Where("user_id = ?", userID)
	}

	query.Scan(&results)

	stats := gin.H{
		"pending":    0,
		"processing": 0,
		"shipped":    0,
		"in_transit": 0,
		"delivered":  0,
		"cancelled":  0,
	}

	for _, r := range results {
		stats[r.Status] = r.Count
	}

	c.JSON(http.StatusOK, stats)
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "order-service",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// ============================================================
// MAIN
// ============================================================

func main() {
	jwtSecret = []byte(getEnv("JWT_SECRET", "default-secret-key"))

	initDB()
	initRabbitMQ()

	if mqConn != nil {
		defer mqConn.Close()
	}
	if mqChannel != nil {
		defer mqChannel.Close()
	}

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
	r.GET("/orders/tracking/:tracking", getOrderByTracking)

	// Protected routes
	api := r.Group("/api")
	api.Use(authMiddleware())
	{
		api.POST("/orders", createOrder)
		api.GET("/orders", getOrders)
		api.GET("/orders/stats", getOrderStats)
		api.GET("/orders/:id", getOrder)
		api.PUT("/orders/:id/status", updateOrderStatus)
		api.DELETE("/orders/:id", deleteOrder)
	}

	port := getEnv("PORT", "8002")
	log.Printf("[Order Service] Berjalan di port %s", port)

	if err := r.Run(":" + port); err != nil {
		log.Fatal("[Order Service] Gagal menjalankan server:", err)
	}
}
