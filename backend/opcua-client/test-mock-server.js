import { OPCUAServer, Variant, DataType, StatusCodes } from "node-opcua";

async function createMockServer() {
    const server = new OPCUAServer({
        port: 4841,
        resourcePath: "/UA/CLPM",
        buildInfo: {
            productName: "CLPM Mock OPC UA Server",
            buildNumber: "1.0.0",
            buildDate: new Date()
        }
    });

    await server.initialize();
    console.log("Mock OPC UA Server initialized");

    // Add sample data
    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();

    // Create some mock process values
    const mockDevice = namespace.addObject({
        organizedBy: addressSpace.rootFolder.objects,
        browseName: "MockDevice"
    });

    // Add process variables
    const pvNode = namespace.addVariable({
        componentOf: mockDevice,
        browseName: "ProcessValue",
        nodeId: "ns=1;i=1001",
        dataType: "Double",
        value: {
            get: () => new Variant({ dataType: DataType.Double, value: Math.random() * 100 })
        }
    });

    const opNode = namespace.addVariable({
        componentOf: mockDevice,
        browseName: "OutputPercent", 
        nodeId: "ns=1;i=1002",
        dataType: "Double",
        value: {
            get: () => new Variant({ dataType: DataType.Double, value: Math.random() * 100 })
        }
    });

    const spNode = namespace.addVariable({
        componentOf: mockDevice,
        browseName: "Setpoint",
        nodeId: "ns=1;i=1003", 
        dataType: "Double",
        value: {
            get: () => new Variant({ dataType: DataType.Double, value: 50 + Math.random() * 10 })
        }
    });

    console.log("Mock variables created:");
    console.log("- ProcessValue: ns=1;i=1001");
    console.log("- OutputPercent: ns=1;i=1002"); 
    console.log("- Setpoint: ns=1;i=1003");

    await server.start();
    console.log("Mock OPC UA Server started");
    console.log("Server endpoint: opc.tcp://localhost:4841/UA/CLPM");

    // Keep server running
    process.on('SIGTERM', async () => {
        console.log('Shutting down mock server...');
        await server.shutdown();
        process.exit(0);
    });
}

createMockServer().catch(console.error);