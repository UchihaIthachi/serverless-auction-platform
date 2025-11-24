LOCALSTACK_ENDPOINT=http://localhost:4566
REGION=us-east-1

.PHONY: localstack-up localstack-down localstack-logs localstack-bootstrap

localstack-up:
	docker compose up -d localstack
	@echo "Waiting for LocalStack..."
	@until aws --endpoint-url=$(LOCALSTACK_ENDPOINT) sts get-caller-identity >/dev/null 2>&1; do \
	  echo "[wait] LocalStack not ready yet..."; \
	  sleep 2; \
	done
	$(MAKE) localstack-bootstrap

localstack-down:
	docker compose down

localstack-logs:
	docker logs -f localstack

localstack-bootstrap:
	bash scripts/localstack-bootstrap.sh $(LOCALSTACK_ENDPOINT) $(REGION)
