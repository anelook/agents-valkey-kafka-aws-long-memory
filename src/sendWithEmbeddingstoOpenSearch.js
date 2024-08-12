import Kafka from 'node-rdkafka';
import { Client } from "@opensearch-project/opensearch";
import { Document } from "langchain/document";
import { BedrockEmbeddings } from "@langchain/aws";
import { OpenSearchVectorStore } from "@langchain/community/vectorstores/opensearch";
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    nodes: [process.env.OPENSEARCH_SERVICE_URI],
});

const consumeAndIndex = (topicName) => {
    // Kafka consumer setup
    const consumer = new Kafka.KafkaConsumer({
        'group.id': 'kafka-group',
        'metadata.broker.list': process.env["KAFKA_SERVICE_URI"],
        'security.protocol': 'ssl',
        'ssl.key.location': process.env["ssl.key.location"],
        'ssl.certificate.location': process.env["ssl.certificate.location"],
        'ssl.ca.location': process.env["ssl.ca.location"],
    }, {});

    consumer.connect();

    consumer.on('ready', () => {
        console.log('Consumer ready');
        consumer.subscribe([topicName]);
        consumer.consume();
    }).on('data', async (data) => {
        const messageValue = data.value.toString();

        // Process the message and create a Document
        const doc = new Document({
            metadata: { source: 'kafka' },
            pageContent: messageValue,
        });

        // Create embeddings and send to OpenSearch
        try {
            const embeddings = new BedrockEmbeddings({
                region: 'us-east-1',
                credentials: {
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID
                },
                model: "amazon.titan-embed-text-v1",
            });

            await OpenSearchVectorStore.fromDocuments([doc], embeddings, {
                client,
                indexName: topicName.toLowerCase(),
            });

            console.log('Document indexed successfully:', doc);
        } catch (error) {
            console.error('Error indexing document:', error);
        }
    });

    consumer.on('event.error', (err) => {
        console.error('Error from consumer:', err);
    });
};

export default consumeAndIndex;
