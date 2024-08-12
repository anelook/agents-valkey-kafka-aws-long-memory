import Agent from './src/agent.js';
import consumeAndIndex from "./src/sendWithEmbeddingstoOpenSearch.js";

const kafkaTopic = Date.now().toString();
const agent2 = new Agent('Nick', 'Judy', kafkaTopic);
consumeAndIndex("Nick-reflections");
agent2.start();

const agent1 = new Agent('Judy', 'Nick', kafkaTopic);
agent1.start();
consumeAndIndex("Judy-reflections");


