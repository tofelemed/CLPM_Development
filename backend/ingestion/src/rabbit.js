import amqp from 'amqplib';
import pino from 'pino';
const log = pino();

export async function createChannel(url, exchange) {
  const conn = await amqp.connect(url);
  const ch = await conn.createChannel();
  await ch.assertExchange(exchange, 'topic', { durable: true });
  log.info({ url, exchange }, 'Connected to RabbitMQ');
  return ch;
}
