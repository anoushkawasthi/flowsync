import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─────────────────────────────────────────────
    // DYNAMODB TABLES
    // ─────────────────────────────────────────────

    const projectsTable = new dynamodb.Table(this, 'FlowSyncProjects', {
      tableName: 'flowsync-projects',
      partitionKey: { name: 'projectId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // easy cleanup after hackathon
    });

    const eventsTable = new dynamodb.Table(this, 'FlowSyncEvents', {
      tableName: 'flowsync-events',
      partitionKey: { name: 'projectId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestampEventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // GSI: direct lookup by eventId
    eventsTable.addGlobalSecondaryIndex({
      indexName: 'EventIdIndex',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    // GSI: all events for a branch (app writes branchTimestamp = "branch#timestamp")
    eventsTable.addGlobalSecondaryIndex({
      indexName: 'BranchIndex',
      partitionKey: { name: 'projectId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'branchTimestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const contextTable = new dynamodb.Table(this, 'FlowSyncContext', {
      tableName: 'flowsync-context',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // GSI: all context for a project (sorted by time)
    contextTable.addGlobalSecondaryIndex({
      indexName: 'ProjectContextIndex',
      partitionKey: { name: 'projectId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'extractedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    // GSI: all context for a branch (app writes branchExtractedAt = "branch#extractedAt")
    contextTable.addGlobalSecondaryIndex({
      indexName: 'BranchContextIndex',
      partitionKey: { name: 'projectId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'branchExtractedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const auditTable = new dynamodb.Table(this, 'FlowSyncAudit', {
      tableName: 'flowsync-audit',
      partitionKey: { name: 'entityId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const allTables = [projectsTable, eventsTable, contextTable, auditTable];

    // ─────────────────────────────────────────────
    // S3 BUCKETS
    // ─────────────────────────────────────────────

    const rawEventsBucket = new s3.Bucket(this, 'FlowSyncRawEvents', {
      bucketName: `flowsync-raw-events-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const dashboardBucket = new s3.Bucket(this, 'FlowSyncDashboard', {
      bucketName: `flowsync-dashboard-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // served via CloudFront only
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ─────────────────────────────────────────────
    // CLOUDFRONT
    // ─────────────────────────────────────────────

    const distribution = new cloudfront.Distribution(this, 'FlowSyncCDN', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(dashboardBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // ─────────────────────────────────────────────
    // IAM: BEDROCK POLICY (for AI Processing Lambda)
    // ─────────────────────────────────────────────

    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
        `arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1`,
      ],
    });

    // ─────────────────────────────────────────────
    // LAMBDA FUNCTIONS
    // ─────────────────────────────────────────────

    const ingestionFn = new lambda.Function(this, 'IngestionFn', {
      functionName: 'flowsync-ingestion',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/ingestion')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        PROJECTS_TABLE: projectsTable.tableName,
        EVENTS_TABLE: eventsTable.tableName,
        CONTEXT_TABLE: contextTable.tableName,
        AUDIT_TABLE: auditTable.tableName,
        RAW_EVENTS_BUCKET: rawEventsBucket.bucketName,
        AI_PROCESSING_FUNCTION_NAME: 'flowsync-ai-processing',
      },
    });

    const aiProcessingFn = new lambda.Function(this, 'AiProcessingFn', {
      functionName: 'flowsync-ai-processing',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/ai_processing')),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        PROJECTS_TABLE: projectsTable.tableName,
        EVENTS_TABLE: eventsTable.tableName,
        CONTEXT_TABLE: contextTable.tableName,
        AUDIT_TABLE: auditTable.tableName,
      },
    });
    aiProcessingFn.addToRolePolicy(bedrockPolicy);

    const mcpFn = new lambda.Function(this, 'McpFn', {
      functionName: 'flowsync-mcp',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/mcp')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        PROJECTS_TABLE: projectsTable.tableName,
        CONTEXT_TABLE: contextTable.tableName,
        AUDIT_TABLE: auditTable.tableName,
      },
    });
    mcpFn.addToRolePolicy(bedrockPolicy); // needed for search_context answer generation

    const queryFn = new lambda.Function(this, 'QueryFn', {
      functionName: 'flowsync-query',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/query')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        PROJECTS_TABLE: projectsTable.tableName,
        CONTEXT_TABLE: contextTable.tableName,
      },
    });
    queryFn.addToRolePolicy(bedrockPolicy);

    // Grant DynamoDB permissions
    allTables.forEach(table => {
      table.grantReadWriteData(ingestionFn);
      table.grantReadWriteData(aiProcessingFn);
      table.grantReadWriteData(mcpFn);
      table.grantReadWriteData(queryFn);
    });

    // Grant S3 permissions
    rawEventsBucket.grantPut(ingestionFn);

    // Grant Ingestion Lambda permission to invoke AI Processing Lambda
    aiProcessingFn.grantInvoke(ingestionFn);

    // ─────────────────────────────────────────────
    // API GATEWAY (REST API)
    // ─────────────────────────────────────────────

    const api = new apigateway.RestApi(this, 'FlowSyncApi', {
      restApiName: 'flowsync-api',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const ingestionIntegration = new apigateway.LambdaIntegration(ingestionFn);
    const mcpIntegration = new apigateway.LambdaIntegration(mcpFn);
    const queryIntegration = new apigateway.LambdaIntegration(queryFn);

    // /api/v1
    const apiV1 = api.root.addResource('api').addResource('v1');

    // POST /api/v1/events
    apiV1.addResource('events').addMethod('POST', ingestionIntegration);

    // POST /api/v1/projects
    // GET  /api/v1/projects/{projectId}
    // GET  /api/v1/projects/{projectId}/events
    const projects = apiV1.addResource('projects');
    projects.addMethod('POST', ingestionIntegration);
    const projectById = projects.addResource('{projectId}');
    projectById.addMethod('GET', ingestionIntegration);
    projectById.addResource('events').addMethod('GET', queryIntegration);

    // POST /api/v1/query
    apiV1.addResource('query').addMethod('POST', queryIntegration);

    // POST /mcp
    api.root.addResource('mcp').addMethod('POST', mcpIntegration);

    // ─────────────────────────────────────────────
    // OUTPUTS (printed after deploy)
    // ─────────────────────────────────────────────

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway base URL — share with team',
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Dashboard URL',
    });

    new cdk.CfnOutput(this, 'RawEventsBucket', {
      value: rawEventsBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'DashboardBucket', {
      value: dashboardBucket.bucketName,
    });
  }
}
