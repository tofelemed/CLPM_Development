export const cfg = {
  rabbitUrl: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  exchange: process.env.INGESTION_EXCHANGE || 'ingestion.raw',
  opcEndpoint: process.env.OPCUA_ENDPOINT || 'opc.tcp://localhost:4840/UA/CLPM',
  loops: JSON.parse(process.env.LOOPS_JSON || '[]')
};
