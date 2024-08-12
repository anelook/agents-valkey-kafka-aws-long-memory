import { valkeyClient, generateResponse, delay } from './common.js';
import { producer } from "./producer.js";
import Valkey from "iovalkey";
import { consumeMessagesFromStartToEnd } from "./consumer.js";
import { LongMemoryService } from './longTermMemory.js';
import {
    getPromptStart,
    getMemoryPrompt,
    getContinuationMemoryPrompt,
    getFirstPrompt,
    getContinuationPrompt,
    getConversationSummaryPrompt
} from './prompts.js';

class Agent {
    constructor(agentName, anotherAgent, conversationTopic) {
        console.log({ conversationTopic })
        this.agentName = agentName;
        this.anotherAgent = anotherAgent;
        this.shortMemory = [];
        this.conversationTopic = conversationTopic;

        this.longMemoryService = new LongMemoryService(`${this.agentName.toLowerCase()}-reflections`);
    }

    async queryLongTermMemory(message) {
        const longmemory = await this.longMemoryService.getLongMemory(`\n\nHuman: ${message} \n\nAssistant:`);
        console.log("******* " + this.agentName.toUpperCase() + " LONG MEMORY: " + longmemory);
        console.log("************************************************************************************");
        return longmemory;
    }

    async agentPrompt(message) {
        // start of the conversation:
        if (!message) {
            const memoriesOfOtherAgent = await this.queryLongTermMemory(getMemoryPrompt(this.agentName, this.anotherAgent));
            const firstPrompt = getFirstPrompt(this.agentName, memoriesOfOtherAgent);
            console.log("+++++++ " + this.agentName.toUpperCase() + " FIRST PROMPT: ", firstPrompt);
            console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ ");
            return firstPrompt;
        }

        // continuation of the conversation:
        let memoryString = this.shortMemory.join('\n');
        let longTermMemory = await this.queryLongTermMemory(getContinuationMemoryPrompt(this.agentName, this.anotherAgent, message));
        const prompt = getContinuationPrompt(this.agentName, memoryString, longTermMemory, message);

        console.log("================= " + this.agentName.toUpperCase() + " CONTINUE PROMPT: " + prompt);
        console.log("================= ================= ================= ================= ================= ");
        return prompt;
    }

    async getConversationSummary(content) {
        const prompt = getConversationSummaryPrompt(this.agentName, content);
        return await generateResponse(prompt);
    }

    storeInKafka(topic, message) {
        producer.produce(
            topic,
            null,
            Buffer.from(message),
            null,
            Date.now()
        );
        producer.flush();
    }

    async triggerReflection(recipient) {
        await valkeyClient.publish(`${recipient}-internalize`, "Reflect on the conversation");
        await valkeyClient.publish(`${this.agentName}-internalize`, "Reflect on the conversation");
    }

    async replyToMessage(message, recipient) {
        //agent indicated that no longer wants to continue conversation
        if (message && message.includes("END")) {
            return await this.triggerReflection(recipient);
        }

        const prompt = await this.agentPrompt(message);
        const response = await generateResponse(prompt);

        // Update shortMemory
        this.shortMemory.push(`YOU SAID: "${response}"`);
        if (message) {
            this.shortMemory.push(`${this.agentName} said: "${message}"`);
        }

        await valkeyClient.publish(recipient, JSON.stringify({ agent: this.agentName, message: response }));
    }

    async reflect() {
        console.log("REFLECT", `${this.agentName}-internalize`);

        const messages = await consumeMessagesFromStartToEnd(this.conversationTopic, `${this.conversationTopic}-${this.agentName}`);

        console.log('Consumed messages:', messages);
        const summary = await this.getConversationSummary(messages.join("; "));
        console.log({ summary })
        this.storeInKafka(`${this.agentName}-reflections`, summary);
    }

    subscribe(subscriber, channel) {
        subscriber.subscribe(channel, async (err, count) => {
            if (err) {
                console.error("ERROR: Failed to subscribe: %s", err.message);
            } else {
                console.log(`NOTIFICATION: Subscribed successfully! Agent ${this.agentName} is currently subscribed to ${count} channel(s).`);
            }
        });
    }

    startToListenToOthers(subscriber) {
        subscriber.on('message', async (channel, message) => {
            if (channel !== this.agentName) return;

            const parsedMessage = JSON.parse(message);
            console.log(`------- ${parsedMessage.agent.toUpperCase()}: ${parsedMessage.message}`);

            this.storeInKafka(this.conversationTopic, message);
            await delay(1000);
            await this.replyToMessage(parsedMessage.message, parsedMessage.agent);
        });
    }

    waitToConversationEnd(subscriber) {
        subscriber.on('message', async (channel) => {
            if (channel !== `${this.agentName}-internalize`) return;

            await this.reflect();
        });
    }

    async start() {
        const subscriber = new Valkey(process.env.VALKEY_SERVICE_URI);

        // listen what another agent tells you
        this.subscribe(subscriber, this.agentName);
        this.startToListenToOthers(subscriber);
        // get ready to process the conversation
        this.subscribe(subscriber, `${this.agentName}-internalize`);
        this.waitToConversationEnd(subscriber);

        // Start the conversation by sending the first message
        // todo improve that only one agent starts
        if (this.agentName === 'Judy') {
            await this.replyToMessage(null, this.anotherAgent);
        }
    }
}

export default Agent;
