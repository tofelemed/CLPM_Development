import { OPCUAServer, Variant, DataType } from "node-opcua";
import pino from "pino";
const log = pino();

const port = 51310
const endpoint = `opc.tcp://0.0.0.0:${port}`;

function nowSeconds() { return Date.now() / 1000; }

(async () => {
  const server = new OPCUAServer({ port, resourcePath: "/UA/CLPM", buildInfo: { productName: "CLPM-Mock" } });
  await server.initialize();
  const addressSpace = server.engine.addressSpace;
  const ns = addressSpace.getOwnNamespace();

  const device = ns.addObject({
    organizedBy: addressSpace.rootFolder.objects,
    browseName: "Loop001"
  });

  let PV = 50, SP = 50, OP = 50; let MODE = "AUTO";
  let t0 = nowSeconds();

  ns.addVariable({
    componentOf: device, browseName: "PV", dataType: "Double",
    value: { get: () => new Variant({ dataType: DataType.Double, value: PV }) }
  });
  ns.addVariable({
    componentOf: device, browseName: "SP", dataType: "Double",
    value: { get: () => new Variant({ dataType: DataType.Double, value: SP }) }
  });
  ns.addVariable({
    componentOf: device, browseName: "OP", dataType: "Double",
    value: { get: () => new Variant({ dataType: DataType.Double, value: OP }) }
  });
  ns.addVariable({
    componentOf: device, browseName: "Mode", dataType: "String",
    value: { get: () => new Variant({ dataType: DataType.String, value: MODE }) }
  });

  function tick() {
    const t = nowSeconds() - t0;
    SP = 50 + 10 * Math.sin(t / 30 * Math.PI * 2);
    PV = 50 + 8 * Math.sin((t / 30 * Math.PI * 2) - Math.PI / 6);
    OP = 50 + 20 * Math.sin((t / 30 * Math.PI * 2) - Math.PI / 3);
  }
  setInterval(tick, 200);

  await server.start();
  log.info({ endpoint }, "Mock OPC UA server started");
})().catch(err => {
  log.error(err, "Mock OPC UA server failed");
  process.exit(1);
});
