import {redisClient, generateResponse, delay} from './common.js';
import {producer} from "./producer.js";
import Redis from "ioredis";
import {consumeMessagesFromStartToEnd} from "./consumer.js";
import {LongMemoryService} from './longTermMemory.js';

class Agent {
    constructor(agentName, anotherAgent, conversationTopic) {
        console.log({conversationTopic})
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
        const promptStart = `You're an inhabitant of a planet Hipola, a very small and cosy planet. Your name is ${this.agentName}.`;
        const instructions = `Always follow these instructions:

        - if it is the first time you meet this inhabitant, introduce yourself and learn their name;
        - if you met this person before or already know something about them - do not introduce yourself, but relate to the previous conversation
        - if it's ongoing conversation, don't introduce yourself, just continue the conversation, reply or ask question, be natural;
        - after a couple of exchanged messages politely say goodbye
        - answer the questions of the other inhabitant;
        - when you're done talking respond with "[END]";
        `

        // start of the conversation:
        if (!message) {
            const memoriesOfOtherAgent = await this.queryLongTermMemory(`The context are memories of ${this.agentName}. Are there any memories or thoughts about ${this.anotherAgent}?. If yes, respond with "You remember meeting ${this.anotherAgent}, what you remember is that .... [continue based on the additional context]". If there are no info about  ${this.anotherAgent} in the context respond with "You haven't met  ${this.anotherAgent} before". don't provide any other judgement or additional information
           `);


            const firstPrompt =  `${promptStart} ${memoriesOfOtherAgent}.
    
            ${instructions}`
            console.log("+++++++ " + this.agentName.toUpperCase() + " FIRST PROMPT: ", firstPrompt)
            console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ ");
            return firstPrompt;
        }

        // continuation of the conversation:

        let memoryString = this.shortMemory.join('\n');
        let longTermMemory = await this.queryLongTermMemory(`The context are memories of ${this.agentName}. Are there any memories or thoughts about ${this.anotherAgent} relevant to the message "${message}"? if yes return "Something that I remember from past conversations with ${this.anotherAgent} is that .... [continue with a concise list of notes]". 
        
        Otherwise, if there is no relevant context return " nothing relevant that I remember" and be very very very short and don't provide any other judgement or additional information!
        
        `);

        const prompt =  ` 
        ${promptStart}
        You're meeting another inhabitant. This is the conversation so far:\n${memoryString}\n\n\n\n
        
        This is what you remember about them from previous interactions that is relevant to their phrase:\n${longTermMemory} Reply to this message from another inhabitant from the planet Hipola: "${message}" and ask a relevant question to continue the conversation. If you already had several messages exchanged, politely say goodbye and end conversation. Be concise. Remember, you're ${this.agentName}. 
        
        
        ${instructions}`;

        console.log("================= " + this.agentName.toUpperCase() + " CONTINUE PROMPT: " + prompt);
        console.log("================= ================= ================= ================= ================= ");
        return prompt;
    }

    async getConversationSummary(content) {
        const prompt = `You're an inhabitant of a planet Hipola, a very small and cosy planet. Your name is ${this.agentName}. you met another citizen and had this conversation: ${content}. Reflect on this conversation and summarize in one most important thought that worth remembering about the person you met, output only the thought. Remember, you're  ${this.agentName}.`;

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
        await redisClient.publish(`${recipient}-internalize`, "Reflect on the conversation");
        await redisClient.publish(`${this.agentName}-internalize`, "Reflect on the conversation");
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

        await redisClient.publish(recipient, JSON.stringify({agent: this.agentName, message: response}));
    }

    async reflect() {
        console.log("REFLECT", `${this.agentName}-internalize`);

        const messages = await consumeMessagesFromStartToEnd(this.conversationTopic, `${this.conversationTopic}-${this.agentName}`);

        console.log('Consumed messages:', messages);
        const summary = await this.getConversationSummary(messages.join("; "));
        console.log({summary})
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
        const subscriber = new Redis(process.env.VALKEY);

        // listen what another agent tells you
        this.subscribe(subscriber, this.agentName);
        this.startToListenToOthers(subscriber);
        // get ready to process the conversation
        this.subscribe(subscriber, `${this.agentName}-internalize`);
        this.waitToConversationEnd(subscriber);

        // Start the conversation by sending the first message
        // todo improve that only one agents starts
        if (this.agentName === 'Judy') {
            await this.replyToMessage(null, this.anotherAgent);
        }
    }
}

export default Agent;