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

# OpenSearch service
resource "aiven_valkey" "valkey-service" {
  project                 = var.project_name
  cloud_name              = "aws-us-east-2"
  plan                    = "startup-4"
  service_name            = "kafka-agents-pub-sub"
}