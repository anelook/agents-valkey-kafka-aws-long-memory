import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import Valkey from 'iovalkey';
import dotenv from 'dotenv';
dotenv.config();

export const valkeyClient = new Valkey(process.env.VALKEY);

export const client = new BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: {
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID
    }
});

export const generateResponse = async (prompt) => {
    const input = {
        modelId: "anthropic.claude-3-haiku-20240307-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ]
        })
    };

    const command = new InvokeModelCommand(input);
    const resp = await client.send(command);
    const decodedResponseBody = JSON.parse(new TextDecoder().decode(resp.body));
    // console.log(decodedResponseBody.content[0].text)
    return decodedResponseBody.content[0].text;//decodedResponseBody.results[0].outputText;
};
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));