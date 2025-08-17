import amqp from 'amqplib';

export async function createChannel(rabbitmqUrl, exchange) {
  try {
    const connection = await amqp.connect(rabbitmqUrl);
    const channel = await connection.createChannel();
    
    // Ensure exchange exists
    await channel.assertExchange(exchange, 'topic', { durable: true });
    
    return channel;
  } catch (error) {
    throw new Error(`Failed to create RabbitMQ channel: ${error.message}`);
  }
}
