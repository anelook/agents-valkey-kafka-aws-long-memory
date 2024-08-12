import Kafka from 'node-rdkafka';
import dotenv from 'dotenv';
dotenv.config();

export const consumeMessagesFromStartToEnd = async (topic, groupId) => {
    return new Promise((resolve, reject) => {
        console.log('Initializing Kafka Consumer...');
        const consumer = new Kafka.KafkaConsumer({
            'group.id': groupId,
            'metadata.broker.list': process.env["kafka.uri"],
            'security.protocol': 'ssl',
            'ssl.key.location': process.env["ssl.key.location"],
            'ssl.certificate.location': process.env["ssl.certificate.location"],
            'ssl.ca.location': process.env["ssl.ca.location"],
            'enable.auto.commit': false
        }, {
            'auto.offset.reset': 'earliest'
        });

        const messages = [];
        let latestOffset;

        consumer.on('ready', () => {
            console.log('Consumer is ready, querying watermark offsets...');
            consumer.queryWatermarkOffsets(topic, 0, 1000, (err, offsets) => {
                if (err) {
                    console.error('Error querying watermark offsets:', err);
                    return reject(err);
                }

                latestOffset = offsets.highOffset;
                console.log(`Latest offset for topic ${topic} is ${latestOffset}`);

                consumer.subscribe([topic]);
                console.log(`Subscribed to topic ${topic}, starting consumption...`);
                consumer.consume();
            });
        });

        consumer.on('data', (data) => {
            console.log('Received data:', data);
            const messageOffset = data.offset;

            console.log(`Message offset: ${messageOffset}, Latest offset: ${latestOffset}`);
            // Only consume messages up to the latest offset

                messages.push(data.value.toString());
                console.log('Message added to the list.', data.value.toString());
            if (messageOffset === latestOffset - 1) {
                console.log('Reached the latest offset, disconnecting...');
                consumer.disconnect();
            }
        });

        consumer.on('disconnected', () => {
            console.log('Consumer disconnected');
            resolve(messages);
        });

        consumer.on('event.error', (err) => {
            console.error('Error event:', err);
            reject(err);
        });

        consumer.on('event.log', (log) => {
            console.log('Log event:', log);
        });

        consumer.on('connection.failure', (err) => {
            console.error('Connection failure:', err);
        });

        console.log('Connecting to Kafka...');
        consumer.connect();
    });
};

// Example usage
// consumeMessagesFromStartToEnd('your-topic', 'your-group-id')
//     .then(messages => {
//         console.log('Consumed messages:', messages);
//     })
//     .catch(err => {
//         console.error('Error consuming messages:', err);
//     });
