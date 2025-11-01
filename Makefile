LOCALSTACK_ENDPOINT=http://localhost:4566
REGION=us-east-1

.PHONY: localstack-up localstack-down localstack-logs localstack-bootstrap

localstack-up:
	docker compose up -d localstack
	@echo "Waiting for LocalStack..."
	sleep 3
	$(MAKE) localstack-bootstrap

localstack-down:
	docker compose down

localstack-logs:
	docker logs -f localstack

localstack-bootstrap:
	bash scripts/localstack-bootstrap.sh $(LOCALSTACK_ENDPOINT) $(REGION)
