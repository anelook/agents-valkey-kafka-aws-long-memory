import { BedrockChat } from "@langchain/community/chat_models/bedrock";
import dotenv from 'dotenv';
import { Client } from "@opensearch-project/opensearch";
import { OpenSearchVectorStore } from "@langchain/community/vectorstores/opensearch";
import { BedrockEmbeddings } from "@langchain/aws";
import { VectorDBQAChain } from "langchain/chains";

dotenv.config();

export class LongMemoryService {
    constructor(indexName) {
        this.model = new BedrockChat({
            model: "anthropic.claude-3-haiku-20240307-v1:0",
            region: "us-east-1",
            credentials: {
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                accessKeyId: process.env.AWS_ACCESS_KEY_ID
            },
        });

        this.client = new Client({
            nodes: [process.env.OPENSEARCH_URL],
        });

        this.vectorStore = new OpenSearchVectorStore(new BedrockEmbeddings({
            region: 'us-east-1',
            credentials: {
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                accessKeyId: process.env.AWS_ACCESS_KEY_ID
            },
            model: "amazon.titan-embed-text-v1"
        }), {
            client: this.client,
            indexName: indexName,
        });

        this.chain = VectorDBQAChain.fromLLM(this.model, this.vectorStore, {
            k: 1,
            returnSourceDocuments: true,
        });
    }

    async getLongMemory(query) {
        const response = await this.chain.call({ query });
        return response.text;
    }
}

// Usage:
// const longMemoryService = new LongMemoryService("your-index-name");
// longMemoryService.getLongMemory("your query").then(response => {
//     console.log(response);
// });
