'use strict';

// Applies API Gateway throttling after every deploy: a default for every method
// on the stage, plus tighter limits on chosen methods (placeBid).
//
// Serverless Framework v3 creates the REST API stage through its Deployment
// resource, so stage method settings can't be set in the template. This plugin
// sets them with UpdateStage instead, from custom.throttling:
//
//   custom:
//     throttling:
//       stage:   { rateLimit: 20, burstLimit: 40 }
//       methods: [{ path: /auction/{id}/bid, method: PATCH, rateLimit: 10, burstLimit: 20 }]
//
// Requests over the limit get 429 Too Many Requests before any Lambda runs, so
// a flood costs API Gateway requests only, not Lambda or DynamoDB.

// A resource path inside a patch path escapes "/" as "~1" (JSON Pointer).
const escapePath = (p) => p.replace(/~/g, '~0').replace(/\//g, '~1');

function patchOperations(throttling) {
  const ops = [];
  const add = (prefix, { rateLimit, burstLimit }) => {
    if (rateLimit !== undefined) ops.push({ op: 'replace', path: `${prefix}/throttling/rateLimit`, value: String(rateLimit) });
    if (burstLimit !== undefined) ops.push({ op: 'replace', path: `${prefix}/throttling/burstLimit`, value: String(burstLimit) });
  };
  if (throttling.stage) add('/*/*', throttling.stage);
  for (const m of throttling.methods || []) {
    const path = m.path.startsWith('/') ? m.path : `/${m.path}`;
    add(`/${escapePath(path)}/${m.method.toUpperCase()}`, m);
  }
  return ops;
}

class StageThrottling {
  constructor(serverless) {
    this.serverless = serverless;
    this.provider = serverless.getProvider('aws');
    this.hooks = { 'after:deploy:deploy': () => this.apply() };
  }

  async apply() {
    const throttling = (this.serverless.service.custom || {}).throttling;
    if (!throttling) return;
    const log = (msg) => this.serverless.cli.log(`[stage-throttling] ${msg}`);
    const stageName = this.provider.getStage();

    const { StackResourceDetail } = await this.provider.request('CloudFormation', 'describeStackResource', {
      StackName: this.provider.naming.getStackName(),
      LogicalResourceId: 'ApiGatewayRestApi',
    });
    const restApiId = StackResourceDetail.PhysicalResourceId;
    const ops = patchOperations(throttling);

    await this.provider.request('APIGateway', 'updateStage', { restApiId, stageName, patchOperations: ops });
    log(`${restApiId}/${stageName}: ${ops.map((o) => `${o.path}=${o.value}`).join(', ')}`);
  }
}

module.exports = StageThrottling;
module.exports.patchOperations = patchOperations;
