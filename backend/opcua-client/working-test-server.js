import { OPCUAServer, Variant, DataType, StatusCodes } from "node-opcua";

async function createWorkingTestServer() {
    const server = new OPCUAServer({
        port: 4842,
        resourcePath: "/UA/TestServer",
        buildInfo: {
            productName: "CLPM Test OPC UA Server",
            buildNumber: "1.0.0",
            buildDate: new Date()
        }
    });

    await server.initialize();
    console.log("Working Test OPC UA Server initialized");

    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();

    // Create device folder
    const deviceFolder = namespace.addFolder(addressSpace.rootFolder.objects, {
        browseName: "TestDevice"
    });

    // Add simple variables that work with node-opcua
    const processValue = namespace.addVariable({
        componentOf: deviceFolder,
        browseName: "ProcessValue",
        nodeId: "ns=1;s=ProcessValue",
        dataType: "Double",
        value: {
            get: () => {
                return new Variant({
                    dataType: DataType.Double, 
                    value: Math.random() * 100
                });
            }
        }
    });

    const temperature = namespace.addVariable({
        componentOf: deviceFolder,
        browseName: "Temperature", 
        nodeId: "ns=1;s=Temperature",
        dataType: "Double",
        value: {
            get: () => {
                return new Variant({
                    dataType: DataType.Double, 
                    value: 20 + Math.random() * 30
                });
            }
        }
    });

    const pressure = namespace.addVariable({
        componentOf: deviceFolder,
        browseName: "Pressure",
        nodeId: "ns=1;s=Pressure", 
        dataType: "Double",
        value: {
            get: () => {
                return new Variant({
                    dataType: DataType.Double, 
                    value: 101325 + Math.random() * 10000
                });
            }
        }
    });

    console.log("Test variables created:");
    console.log("- ProcessValue: ns=1;s=ProcessValue");
    console.log("- Temperature: ns=1;s=Temperature");
    console.log("- Pressure: ns=1;s=Pressure");

    await server.start();
    console.log("Working Test OPC UA Server started");
    console.log("Server endpoint: opc.tcp://localhost:4842/UA/TestServer");

    // Keep server running
    process.on('SIGTERM', async () => {
        console.log('Shutting down test server...');
        await server.shutdown();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('Shutting down test server...');
        await server.shutdown();
        process.exit(0);
    });
}

createWorkingTestServer().catch(console.error);