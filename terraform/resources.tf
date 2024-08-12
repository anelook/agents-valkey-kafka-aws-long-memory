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

# Valkey service
resource "aiven_valkey" "valkey-service" {
  project                 = var.project_name
  cloud_name              = "aws-us-east-2"
  plan                    = "startup-4"
  service_name            = "kafka-agents-pub-sub"
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

resource "local_sensitive_file" "kafka_access_cert" {
  content = <<-EOT
    ${aiven_kafka.kafka-service1.kafka[0].access_cert}
  EOT
  filename          = "../certificates/service.cert"
}

resource "local_sensitive_file" "kafka_access_key" {
  content = <<-EOT
    ${aiven_kafka.kafka-service1.kafka[0].access_key}
  EOT
  filename          = "../certificates/service.key"
}

data "aiven_project" "agent_project" {
  project = var.project_name
}

resource "local_sensitive_file" "kafka_ca_pem" {
  content = <<-EOT
    ${data.aiven_project.agent_project.ca_cert}
  EOT
  filename          = "../certificates/ca.pem"
}
