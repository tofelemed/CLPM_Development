import { Logger } from 'pino';
import {
  BrowseDirection,
  NodeClass,
  AttributeIds,
  BrowseDescription,
  ReferenceDescription,
  NodeId,
  DataValue,
  DataType,
  VariantArrayType,
  resolveNodeId,
  makeNodeId
} from 'node-opcua';
import { ConnectionManager } from '../core/ConnectionManager.js';
import { BrowseNode } from '../types/index.js';

export class TagBrowser {
  private logger: Logger;
  private connectionManager: ConnectionManager;

  constructor(logger: Logger, connectionManager: ConnectionManager) {
    this.logger = logger.child({ component: 'TagBrowser' });
    this.connectionManager = connectionManager;
  }

  /**
   * Browse address space starting from a node
   */
  async browse(
    serverId: string,
    nodeId: string = 'RootFolder',
    maxResults: number = 1000
  ): Promise<BrowseNode[]> {
    try {
      const sessionInfo = (this.connectionManager as any).connections.get(serverId);
      
      if (!sessionInfo) {
        throw new Error(`No active session for server ${serverId}`);
      }

      const session = sessionInfo.session;
      
      // Convert string nodeId to NodeId object
      const startNodeId = typeof nodeId === 'string' ? resolveNodeId(nodeId) : nodeId;

      const browseDescription = {
        nodeId: startNodeId,
        browseDirection: BrowseDirection.Forward,
        referenceTypeId: resolveNodeId('References'),
        includeSubtypes: true,
        nodeClassMask: NodeClass.Object | NodeClass.Variable | NodeClass.Method,
        resultMask: 0x3F // All attributes
      };

      const browseResult = await session.browse(browseDescription);
      
      if (!browseResult.references) {
        return [];
      }

      const nodes: BrowseNode[] = [];
      const referencesToProcess = browseResult.references.slice(0, maxResults);

      // Process references in batches to avoid overwhelming the server
      const batchSize = 50;
      for (let i = 0; i < referencesToProcess.length; i += batchSize) {
        const batch = referencesToProcess.slice(i, i + batchSize);
        const batchNodes = await this.processReferenceBatch(session, batch);
        nodes.push(...batchNodes);
      }

      this.logger.debug({ 
        serverId, 
        nodeId: nodeId.toString(), 
        resultCount: nodes.length 
      }, 'Browse completed');

      return nodes.sort((a, b) => a.displayName.localeCompare(b.displayName));

    } catch (error) {
      this.logger.error({ 
        error, 
        serverId, 
        nodeId 
      }, 'Failed to browse address space');
      throw error;
    }
  }

  /**
   * Process a batch of references to get node information
   */
  private async processReferenceBatch(
    session: any,
    references: ReferenceDescription[]
  ): Promise<BrowseNode[]> {
    const nodes: BrowseNode[] = [];

    // Read additional attributes for each reference
    const readRequest = references.map(ref => [
      { nodeId: ref.nodeId, attributeId: AttributeIds.DisplayName },
      { nodeId: ref.nodeId, attributeId: AttributeIds.DataType },
      { nodeId: ref.nodeId, attributeId: AttributeIds.AccessLevel },
      { nodeId: ref.nodeId, attributeId: AttributeIds.UserAccessLevel },
      { nodeId: ref.nodeId, attributeId: AttributeIds.BrowseName }
    ]).flat();

    try {
      const dataValues = await session.read(readRequest);
      
      // Process results in groups of 5 (one for each attribute per reference)
      for (let i = 0; i < references.length; i++) {
        const ref = references[i];
        const baseIndex = i * 5;
        
        const displayNameValue = dataValues[baseIndex];
        const dataTypeValue = dataValues[baseIndex + 1];
        const accessLevelValue = dataValues[baseIndex + 2];
        const userAccessLevelValue = dataValues[baseIndex + 3];
        const browseNameValue = dataValues[baseIndex + 4];

        const node: BrowseNode = {
          nodeId: ref.nodeId.toString(),
          browseName: this.extractValue(browseNameValue) || ref.browseName.toString(),
          displayName: this.extractValue(displayNameValue) || ref.displayName.toString(),
          nodeClass: this.nodeClassToString(ref.nodeClass),
          hasChildren: ref.typeDefinition ? true : false,
          isForward: ref.isForward
        };

        // Add optional attributes
        if (dataTypeValue && dataTypeValue.value?.value) {
          node.dataType = this.dataTypeToString(dataTypeValue.value.value);
        }

        if (accessLevelValue && accessLevelValue.value?.value !== undefined) {
          node.accessLevel = accessLevelValue.value.value;
        }

        if (userAccessLevelValue && userAccessLevelValue.value?.value !== undefined) {
          node.userAccessLevel = userAccessLevelValue.value.value;
        }

        if (ref.typeDefinition) {
          node.typeDefinition = ref.typeDefinition.toString();
        }

        nodes.push(node);
      }
    } catch (error) {
      // If batch read fails, create basic nodes without additional attributes
      this.logger.warn({ error }, 'Failed to read additional attributes, using basic node info');
      
      for (const ref of references) {
        nodes.push({
          nodeId: ref.nodeId.toString(),
          browseName: ref.browseName.toString(),
          displayName: ref.displayName.toString(),
          nodeClass: this.nodeClassToString(ref.nodeClass),
          hasChildren: ref.typeDefinition ? true : false,
          isForward: ref.isForward
        });
      }
    }

    return nodes;
  }

  /**
   * Search for nodes by display name or browse name
   */
  async search(
    serverId: string,
    searchTerm: string,
    maxResults: number = 100,
    startNodeId: string = 'RootFolder'
  ): Promise<BrowseNode[]> {
    try {
      const searchTermLower = searchTerm.toLowerCase();
      const results: BrowseNode[] = [];
      const visitedNodes = new Set<string>();

      await this.searchRecursive(
        serverId,
        startNodeId,
        searchTermLower,
        results,
        visitedNodes,
        maxResults,
        0, // depth
        5  // max depth
      );

      this.logger.debug({ 
        serverId, 
        searchTerm, 
        resultCount: results.length 
      }, 'Search completed');

      return results.sort((a, b) => {
        // Sort by relevance: exact matches first, then contains matches
        const aExact = a.displayName.toLowerCase() === searchTermLower ? 0 : 1;
        const bExact = b.displayName.toLowerCase() === searchTermLower ? 0 : 1;
        
        if (aExact !== bExact) {
          return aExact - bExact;
        }
        
        return a.displayName.localeCompare(b.displayName);
      });

    } catch (error) {
      this.logger.error({ 
        error, 
        serverId, 
        searchTerm 
      }, 'Failed to search nodes');
      throw error;
    }
  }

  /**
   * Recursive search through address space
   */
  private async searchRecursive(
    serverId: string,
    nodeId: string,
    searchTerm: string,
    results: BrowseNode[],
    visitedNodes: Set<string>,
    maxResults: number,
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (results.length >= maxResults || depth > maxDepth || visitedNodes.has(nodeId)) {
      return;
    }

    visitedNodes.add(nodeId);

    try {
      const children = await this.browse(serverId, nodeId, 1000);
      
      for (const child of children) {
        if (results.length >= maxResults) {
          break;
        }

        // Check if this node matches the search term
        const displayNameMatches = child.displayName.toLowerCase().includes(searchTerm);
        const browseNameMatches = child.browseName.toLowerCase().includes(searchTerm);
        const nodeIdMatches = child.nodeId.toLowerCase().includes(searchTerm);

        if (displayNameMatches || browseNameMatches || nodeIdMatches) {
          results.push(child);
        }

        // Recursively search children if this node has children
        if (child.hasChildren && depth < maxDepth) {
          await this.searchRecursive(
            serverId,
            child.nodeId,
            searchTerm,
            results,
            visitedNodes,
            maxResults,
            depth + 1,
            maxDepth
          );
        }
      }
    } catch (error) {
      // Continue searching even if one branch fails
      this.logger.debug({ error, nodeId }, 'Failed to browse node during search');
    }
  }

  /**
   * Get node details including current value
   */
  async getNodeDetails(serverId: string, nodeId: string): Promise<{
    node: BrowseNode;
    value?: any;
    timestamp?: Date;
    quality?: number;
  }> {
    try {
      const sessionInfo = (this.connectionManager as any).connections.get(serverId);
      
      if (!sessionInfo) {
        throw new Error(`No active session for server ${serverId}`);
      }

      const session = sessionInfo.session;
      const targetNodeId = resolveNodeId(nodeId);

      // Read all relevant attributes
      const readRequest = [
        { nodeId: targetNodeId, attributeId: AttributeIds.DisplayName },
        { nodeId: targetNodeId, attributeId: AttributeIds.BrowseName },
        { nodeId: targetNodeId, attributeId: AttributeIds.NodeClass },
        { nodeId: targetNodeId, attributeId: AttributeIds.DataType },
        { nodeId: targetNodeId, attributeId: AttributeIds.AccessLevel },
        { nodeId: targetNodeId, attributeId: AttributeIds.UserAccessLevel },
        { nodeId: targetNodeId, attributeId: AttributeIds.Value }
      ];

      const dataValues = await session.read(readRequest);

      const node: BrowseNode = {
        nodeId: nodeId,
        browseName: this.extractValue(dataValues[1]) || nodeId,
        displayName: this.extractValue(dataValues[0]) || nodeId,
        nodeClass: this.nodeClassToString(dataValues[2]?.value?.value || NodeClass.Unspecified),
        hasChildren: false, // Will be determined by browse if needed
        isForward: true
      };

      // Add optional attributes
      if (dataValues[3]?.value?.value) {
        node.dataType = this.dataTypeToString(dataValues[3].value.value);
      }

      if (dataValues[4]?.value?.value !== undefined) {
        node.accessLevel = dataValues[4].value.value;
      }

      if (dataValues[5]?.value?.value !== undefined) {
        node.userAccessLevel = dataValues[5].value.value;
      }

      // Extract value information
      let value, timestamp, quality;
      const valueData = dataValues[6];
      
      if (valueData) {
        value = valueData.value?.value;
        timestamp = valueData.serverTimestamp || valueData.sourceTimestamp;
        quality = valueData.statusCode?.value;
      }

      this.logger.debug({ serverId, nodeId }, 'Retrieved node details');

      return {
        node,
        value,
        timestamp,
        quality
      };

    } catch (error) {
      this.logger.error({ error, serverId, nodeId }, 'Failed to get node details');
      throw error;
    }
  }

  /**
   * Get the data type of a node
   */
  async getNodeDataType(serverId: string, nodeId: string): Promise<string | undefined> {
    try {
      const sessionInfo = (this.connectionManager as any).connections.get(serverId);
      
      if (!sessionInfo) {
        throw new Error(`No active session for server ${serverId}`);
      }

      const session = sessionInfo.session;
      const targetNodeId = resolveNodeId(nodeId);

      const dataValue = await session.read({
        nodeId: targetNodeId,
        attributeId: AttributeIds.DataType
      });

      if (dataValue && dataValue.value?.value) {
        return this.dataTypeToString(dataValue.value.value);
      }

      return undefined;

    } catch (error) {
      this.logger.error({ error, serverId, nodeId }, 'Failed to get node data type');
      return undefined;
    }
  }

  /**
   * Validate if a node exists and is readable
   */
  async validateNode(serverId: string, nodeId: string): Promise<{
    exists: boolean;
    readable: boolean;
    dataType?: string;
    error?: string;
  }> {
    try {
      const details = await this.getNodeDetails(serverId, nodeId);
      
      const readable = (details.node.userAccessLevel && (details.node.userAccessLevel & 0x01) !== 0) ||
                      (details.node.accessLevel && (details.node.accessLevel & 0x01) !== 0);

      return {
        exists: true,
        readable,
        dataType: details.node.dataType
      };

    } catch (error) {
      return {
        exists: false,
        readable: false,
        error: error.message
      };
    }
  }

  /**
   * Get child nodes of a specific type
   */
  async getChildrenByType(
    serverId: string,
    parentNodeId: string,
    nodeClass: NodeClass
  ): Promise<BrowseNode[]> {
    const allChildren = await this.browse(serverId, parentNodeId);
    
    return allChildren.filter(child => {
      const childNodeClass = this.stringToNodeClass(child.nodeClass);
      return childNodeClass === nodeClass;
    });
  }

  /**
   * Extract value from DataValue
   */
  private extractValue(dataValue: DataValue): any {
    if (!dataValue || !dataValue.value) {
      return null;
    }

    const variant = dataValue.value;
    
    if (variant.arrayType === VariantArrayType.Scalar) {
      return variant.value;
    } else if (variant.arrayType === VariantArrayType.Array) {
      return variant.value;
    }

    return variant.value;
  }

  /**
   * Convert NodeClass enum to string
   */
  private nodeClassToString(nodeClass: NodeClass): string {
    switch (nodeClass) {
      case NodeClass.Object: return 'Object';
      case NodeClass.Variable: return 'Variable';
      case NodeClass.Method: return 'Method';
      case NodeClass.ObjectType: return 'ObjectType';
      case NodeClass.VariableType: return 'VariableType';
      case NodeClass.ReferenceType: return 'ReferenceType';
      case NodeClass.DataType: return 'DataType';
      case NodeClass.View: return 'View';
      default: return 'Unknown';
    }
  }

  /**
   * Convert string to NodeClass enum
   */
  private stringToNodeClass(nodeClassStr: string): NodeClass {
    switch (nodeClassStr) {
      case 'Object': return NodeClass.Object;
      case 'Variable': return NodeClass.Variable;
      case 'Method': return NodeClass.Method;
      case 'ObjectType': return NodeClass.ObjectType;
      case 'VariableType': return NodeClass.VariableType;
      case 'ReferenceType': return NodeClass.ReferenceType;
      case 'DataType': return NodeClass.DataType;
      case 'View': return NodeClass.View;
      default: return NodeClass.Unspecified;
    }
  }

  /**
   * Convert DataType NodeId to string
   */
  private dataTypeToString(dataType: NodeId): string {
    // Map common OPC UA data types
    const dataTypeMap: { [key: string]: string } = {
      'i=1': 'Boolean',
      'i=2': 'SByte',
      'i=3': 'Byte',
      'i=4': 'Int16',
      'i=5': 'UInt16',
      'i=6': 'Int32',
      'i=7': 'UInt32',
      'i=8': 'Int64',
      'i=9': 'UInt64',
      'i=10': 'Float',
      'i=11': 'Double',
      'i=12': 'String',
      'i=13': 'DateTime',
      'i=14': 'Guid',
      'i=15': 'ByteString',
      'i=16': 'XmlElement',
      'i=17': 'NodeId',
      'i=18': 'ExpandedNodeId',
      'i=19': 'StatusCode',
      'i=20': 'QualifiedName',
      'i=21': 'LocalizedText',
      'i=22': 'ExtensionObject',
      'i=23': 'DataValue',
      'i=24': 'Variant',
      'i=25': 'DiagnosticInfo'
    };

    const nodeIdStr = dataType.toString();
    return dataTypeMap[nodeIdStr] || nodeIdStr;
  }

  /**
   * Get server information
   */
  async getServerInfo(serverId: string): Promise<{
    serverStatus?: any;
    buildInfo?: any;
    namespaces?: string[];
  }> {
    try {
      const sessionInfo = (this.connectionManager as any).connections.get(serverId);
      
      if (!sessionInfo) {
        throw new Error(`No active session for server ${serverId}`);
      }

      const session = sessionInfo.session;

      // Read server status and build info
      const readRequest = [
        { nodeId: resolveNodeId('ns=0;i=2256'), attributeId: AttributeIds.Value }, // Server_ServerStatus
        { nodeId: resolveNodeId('ns=0;i=2260'), attributeId: AttributeIds.Value }, // Server_ServerStatus_BuildInfo
        { nodeId: resolveNodeId('ns=0;i=2255'), attributeId: AttributeIds.Value }  // Server_NamespaceArray
      ];

      const dataValues = await session.read(readRequest);
      
      return {
        serverStatus: this.extractValue(dataValues[0]),
        buildInfo: this.extractValue(dataValues[1]),
        namespaces: this.extractValue(dataValues[2])
      };

    } catch (error) {
      this.logger.error({ error, serverId }, 'Failed to get server info');
      return {};
    }
  }
}