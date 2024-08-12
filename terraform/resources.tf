# Kafka service
resource "aiven_kafka" "kafka-service1" {
  project                 = var.project_name
  cloud_name              = "aws-us-east-2"
  plan                    = "business-4"
  service_name            = "kafka-agent-conversation-memory"

  kafka_user_config {
    kafka {
      group_max_session_timeout_ms = 70000
      log_retention_bytes          = 1000000000
      auto_create_topics_enable    = true
    }
  }
}

# Output Kafka service URI
output "kafka_service_uri" {
  value       = aiven_kafka.kafka-service1.service_uri
  description = "URI for connecting to the Kafka service"
  sensitive   = true
}

# Kafka topic
resource "aiven_kafka_topic" "kafka-topic1" {
  project      = var.project_name
  service_name = aiven_kafka.kafka-service1.service_name
  topic_name   = "test-kafka-topic1"
  partitions   = 3
  replication  = 2
}

# OpenSearch service
resource "aiven_opensearch" "open-search-service" {
  project                 = var.project_name
  cloud_name              = "aws-us-east-2"
  plan                    = "startup-4"
  service_name            = "kafka-agents-long-term-memory"
}

# Output OpenSearch service URI
output "opensearch_service_uri" {
  value       = aiven_opensearch.open-search-service.service_uri
  description = "URI for connecting to the OpenSearch service"
  sensitive   = true
}

# Valkey service
resource "aiven_valkey" "valkey-service" {
  project                 = var.project_name
  cloud_name              = "aws-us-east-2"
  plan                    = "startup-4"
  service_name            = "kafka-agents-pub-sub"
}

# Output Valkey service URI
output "valkey_service_uri" {
  value       = aiven_valkey.valkey-service.service_uri
  description = "URI for connecting to the Valkey service"
  sensitive   = true
}


# Store sensitive outputs in a temporary file
resource "local_sensitive_file" "service_uris" {
  content = <<-EOT
    KAFKA_SERVICE_URI="${aiven_kafka.kafka-service1.service_uri}"
    OPENSEARCH_SERVICE_URI="${aiven_opensearch.open-search-service.service_uri}"
    VALKEY_SERVICE_URI="${aiven_valkey.valkey-service.service_uri}"
    ssl.key.location='certificates/service.key'
    ssl.certificate.location='certificates/service.cert'
    ssl.ca.location='certificates/ca.pem'
  EOT
  filename          = "../.env"
}