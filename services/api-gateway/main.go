package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

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
	jwtSecret              []byte
	userServiceURL         string
	orderServiceURL        string
	trackingServiceURL     string
	notificationServiceURL string

	httpClient = &http.Client{
		Timeout: 30 * time.Second,
	}
)

// ============================================================
// PROXY HELPER
// ============================================================

func forwardRequest(c *gin.Context, targetURL string) {
	// Build new request
	req, err := http.NewRequest(c.Request.Method, targetURL, c.Request.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat request"})
		return
	}

	// Copy Content-Type and other safe headers
	if ct := c.GetHeader("Content-Type"); ct != "" {
		req.Header.Set("Content-Type", ct)
	}
	if auth := c.GetHeader("Authorization"); auth != "" {
		req.Header.Set("Authorization", auth)
	}

	// Forward user context as internal headers
	if userID, exists := c.Get("user_id"); exists {
		req.Header.Set("X-User-ID", fmt.Sprintf("%v", userID))
	}
	if email, exists := c.Get("email"); exists {
		req.Header.Set("X-User-Email", fmt.Sprintf("%v", email))
	}
	if role, exists := c.Get("role"); exists {
		req.Header.Set("X-User-Role", fmt.Sprintf("%v", role))
	}

	// Copy query params
	req.URL.RawQuery = c.Request.URL.RawQuery

	// Execute request
	resp, err := httpClient.Do(req)
	if err != nil {
		log.Printf("[API Gateway] Error forwarding to %s: %v", targetURL, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Layanan tidak tersedia, coba lagi nanti"})
		return
	}
	defer resp.Body.Close()

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			c.Header(key, value)
		}
	}

	// Write response
	c.Status(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
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
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak ditemukan"})
			c.Abort()
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid atau sudah kadaluarsa"})
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Next()
	}
}

func rateLimitLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("[API Gateway] %s %s -> %s", c.Request.Method, c.Request.URL.Path, c.ClientIP())
		c.Next()
	}
}

// ============================================================
// HELPERS
// ============================================================

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
	userServiceURL = getEnv("USER_SERVICE_URL", "http://localhost:8001")
	orderServiceURL = getEnv("ORDER_SERVICE_URL", "http://localhost:8002")
	trackingServiceURL = getEnv("TRACKING_SERVICE_URL", "http://localhost:8003")
	notificationServiceURL = getEnv("NOTIFICATION_SERVICE_URL", "http://localhost:8004")

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(rateLimitLogger())

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// ============================================================
	// HEALTH CHECK
	// ============================================================
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "api-gateway",
			"version":   "1.0.0",
			"timestamp": time.Now().Format(time.RFC3339),
			"services": gin.H{
				"user_service":         userServiceURL,
				"order_service":        orderServiceURL,
				"tracking_service":     trackingServiceURL,
				"notification_service": notificationServiceURL,
			},
		})
	})

	// ============================================================
	// PUBLIC ROUTES - Auth
	// ============================================================
	r.POST("/auth/register", func(c *gin.Context) {
		forwardRequest(c, userServiceURL+"/auth/register")
	})
	r.POST("/auth/login", func(c *gin.Context) {
		forwardRequest(c, userServiceURL+"/auth/login")
	})

	// Public tracking by nomor resi
	r.GET("/orders/tracking/:tracking", func(c *gin.Context) {
		tracking := c.Param("tracking")
		forwardRequest(c, orderServiceURL+"/orders/tracking/"+tracking)
	})

	// Public tracking events
	r.GET("/tracking/:order_id", func(c *gin.Context) {
		orderID := c.Param("order_id")
		forwardRequest(c, trackingServiceURL+"/tracking/"+orderID)
	})

	// ============================================================
	// PROTECTED ROUTES
	// ============================================================
	api := r.Group("/api")
	api.Use(authMiddleware())
	{
		// ---- USER SERVICE ----
		api.GET("/profile", func(c *gin.Context) {
			forwardRequest(c, userServiceURL+"/api/profile")
		})
		api.PUT("/profile", func(c *gin.Context) {
			forwardRequest(c, userServiceURL+"/api/profile")
		})
		api.GET("/users", func(c *gin.Context) {
			forwardRequest(c, userServiceURL+"/api/users")
		})
		api.GET("/users/:id", func(c *gin.Context) {
			id := c.Param("id")
			forwardRequest(c, userServiceURL+"/api/users/"+id)
		})

		// ---- ORDER SERVICE ----
		api.POST("/orders", func(c *gin.Context) {
			forwardRequest(c, orderServiceURL+"/api/orders")
		})
		api.GET("/orders", func(c *gin.Context) {
			forwardRequest(c, orderServiceURL+"/api/orders")
		})
		api.GET("/orders/stats", func(c *gin.Context) {
			forwardRequest(c, orderServiceURL+"/api/orders/stats")
		})
		api.GET("/orders/:id", func(c *gin.Context) {
			id := c.Param("id")
			forwardRequest(c, orderServiceURL+"/api/orders/"+id)
		})
		api.PUT("/orders/:id/status", func(c *gin.Context) {
			id := c.Param("id")
			forwardRequest(c, orderServiceURL+"/api/orders/"+id+"/status")
		})
		api.DELETE("/orders/:id", func(c *gin.Context) {
			id := c.Param("id")
			forwardRequest(c, orderServiceURL+"/api/orders/"+id)
		})

		// ---- TRACKING SERVICE ----
		api.POST("/tracking", func(c *gin.Context) {
			forwardRequest(c, trackingServiceURL+"/api/tracking")
		})
		api.GET("/tracking/:order_id", func(c *gin.Context) {
			orderID := c.Param("order_id")
			forwardRequest(c, trackingServiceURL+"/api/tracking/"+orderID)
		})

		// ---- NOTIFICATION SERVICE ----
		api.GET("/notifications", func(c *gin.Context) {
			forwardRequest(c, notificationServiceURL+"/api/notifications")
		})
		// NOTE: read-all must be declared BEFORE :id/read to avoid route conflict
		api.PUT("/notifications/read-all", func(c *gin.Context) {
			forwardRequest(c, notificationServiceURL+"/api/notifications/read-all")
		})
		api.PUT("/notifications/:id/read", func(c *gin.Context) {
			id := c.Param("id")
			forwardRequest(c, notificationServiceURL+"/api/notifications/"+id+"/read")
		})
		api.DELETE("/notifications/:id", func(c *gin.Context) {
			id := c.Param("id")
			forwardRequest(c, notificationServiceURL+"/api/notifications/"+id)
		})
	}

	port := getEnv("PORT", "8000")
	log.Printf("[API Gateway] Berjalan di port %s", port)
	log.Printf("[API Gateway] User Service    : %s", userServiceURL)
	log.Printf("[API Gateway] Order Service   : %s", orderServiceURL)
	log.Printf("[API Gateway] Tracking Service: %s", trackingServiceURL)
	log.Printf("[API Gateway] Notif Service   : %s", notificationServiceURL)

	if err := r.Run(":" + port); err != nil {
		log.Fatal("[API Gateway] Gagal menjalankan server:", err)
	}
}
