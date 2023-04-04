import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Channel, StreamKey } from "@aws-cdk/aws-ivs-alpha";
import { Capability, Stage } from "./ivsrealtime/stage";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Distribution } from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { execSync } from "child_process";

export class IvsMultipleHostsExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const channel = new Channel(this, "Channel");
    const streamKey = new StreamKey(channel, "StreamKey", {
      channel,
    });
    const stage = new Stage(channel, "Stage", {
      participantTokens: [
        {
          userId: "host",
          capabilities: Capability.PUBLISH_SUBSCRIBE,
        },
        {
          userId: "guest",
          capabilities: Capability.PUBLISH_SUBSCRIBE,
        },
      ],
    });
    const websiteBucket = new Bucket(this, "WebsiteBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    const distribution = new Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new S3Origin(websiteBucket),
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
      defaultRootObject: "index.html",
    });
    new BucketDeployment(this, "Deploy", {
      sources: [
        Source.asset("app", {
          exclude: ["nuxt", ".output", "dist"],
          bundling: {
            image: cdk.DockerImage.fromRegistry("node"),
            local: {
              tryBundle(outputDir, _options) {
                execSync("yarn generate", {
                  cwd: "app",
                  stdio: "inherit",
                });
                execSync(`cp -r .output/public/* ${outputDir}`, {
                  cwd: "app",
                  stdio: "inherit",
                });
                return true;
              },
            },
          },
        }),
      ],
      destinationBucket: websiteBucket,
      distribution,
    });
    new cdk.CfnOutput(this, "URL", {
      value: `https://${distribution.domainName}`,
    });
    new cdk.CfnOutput(this, "IngestEndpoint", {
      value: channel.channelIngestEndpoint,
    });
    new cdk.CfnOutput(this, "StreamKeyValue", {
      value: streamKey.streamKeyValue,
    });
    stage.participants.forEach((participant, index) => {
      new cdk.CfnOutput(this, `Participant${index}UserId`, {
        value: participant.userId,
      });
      new cdk.CfnOutput(this, `Participant${index}Token`, {
        value: participant.token,
      });
    });
  }
}
