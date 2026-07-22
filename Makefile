.PHONY: up down build logs clean report

up:
	docker-compose up -d --build

down:
	docker-compose down

build:
	docker-compose build

logs:
	docker-compose logs -f

clean:
	docker-compose down -v --remove-orphans

report:
	@echo "Installing python-docx..."
	pip3 install python-docx --quiet
	@echo "Generating report..."
	python3 docs/generate_report.py
	@echo "Report generated at docs/Laporan_Sistem_Logistik_Terdistribusi.docx"

status:
	docker-compose ps

restart:
	docker-compose restart

dev-gateway:
	cd services/api-gateway && go run main.go

dev-user:
	cd services/user-service && go run main.go

dev-order:
	cd services/order-service && go run main.go

dev-tracking:
	cd services/tracking-service && go run main.go

dev-notification:
	cd services/notification-service && go run main.go

install-frontend:
	cd frontend && npm install

dev-frontend:
	cd frontend && npm run dev
