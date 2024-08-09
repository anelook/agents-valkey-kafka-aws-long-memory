import { Client } from "@opensearch-project/opensearch";
import { Document } from "langchain/document";
import { BedrockEmbeddings } from "@langchain/aws"
import { OpenSearchVectorStore } from "@langchain/community/vectorstores/opensearch";
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
    nodes: [process.env.OPENSEARCH_URL],
});

const docs = [
    new Document({
        metadata: { foo: "bar" },
        pageContent: "opensearch is also a vector db",
    }),
    new Document({
        metadata: { foo: "bar" },
        pageContent: "the quick brown fox jumped over the lazy dog",
    }),
    new Document({
        metadata: { baz: "qux" },
        pageContent: "lorem ipsum dolor sit amet",
    }),
    new Document({
        metadata: { baz: "qux" },
        pageContent:
            "OpenSearch is a scalable, flexible, and extensible open-source software suite for search, analytics, and observability applications",
    }),
];

await OpenSearchVectorStore.fromDocuments(docs, new BedrockEmbeddings({
    region: 'us-east-1',
    credentials: {
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID
    },
    model: "amazon.titan-embed-text-v1",
}), {
    client,
    indexName: "test", // Will default to `documents`
});