import { Duration, Lazy, Names, Resource } from "aws-cdk-lib";
import { PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
  PhysicalResourceIdReference,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

enum CapabilityType {
  PUBLISH = "PUBLISH",
  SUBSCRIBE = "SUBSCRIBE",
}
export class Capability {
  static PUBLISH_ONLY = new Capability([CapabilityType.PUBLISH]);
  static SUBSCRIBE_ONLY = new Capability([CapabilityType.SUBSCRIBE]);
  static PUBLISH_SUBSCRIBE = new Capability([
    CapabilityType.PUBLISH,
    CapabilityType.SUBSCRIBE,
  ]);
  private constructor(readonly value: CapabilityType[]) {}
}

export interface Participant {
  participantId: string;
  token: string;
  userId: string;
}

export interface StageProps {
  stageName?: string;
  participantTokens?: {
    attributes?: { [key: string]: string };
    capabilities?: Capability;
    duration?: Duration;
    userId?: string;
  }[];
}

export class Stage extends Resource {
  readonly stageArn: string;
  readonly participants: Participant[];
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, {
      physicalName:
        props?.stageName ??
        Lazy.string({
          produce: () =>
            Names.uniqueResourceName(this, {
              maxLength: 128,
              allowedSpecialCharacters: "-_",
            }),
        }),
    });
    const stage = new AwsCustomResource(this, "Resource", {
      resourceType: "Custom::ChannelStage",
      onCreate: {
        service: "IVSRealTime",
        action: "createStage",
        parameters: {
          name: this.physicalName,
          participantTokenConfigurations: props?.participantTokens?.map(
            (config) => ({
              attributes: config.attributes,
              capabilities: config.capabilities?.value,
              duration: config.duration?.toMinutes(),
              userId: config.userId,
            })
          ),
        },
        physicalResourceId: PhysicalResourceId.fromResponse("stage.arn"),
      },
      onUpdate: {
        service: "IVSRealTime",
        action: "updateStage",
        parameters: {
          arn: new PhysicalResourceIdReference(),
          name: this.physicalName,
        },
      },
      onDelete: {
        service: "IVSRealTime",
        action: "deleteStage",
        parameters: {
          arn: new PhysicalResourceIdReference(),
        },
      },
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          actions: ["ivs:*"],
          resources: ["*"],
        }),
      ]),
      installLatestAwsSdk: true,
    });
    this.stageArn = stage.getResponseField("stage.arn");
    this.participants =
      props?.participantTokens?.map((_, index) => ({
        participantId: stage.getResponseField(
          `participantTokens.${index}.participantId`
        ),
        token: stage.getResponseField(`participantTokens.${index}.token`),
        userId: stage.getResponseField(`participantTokens.${index}.userId`),
      })) ?? [];
  }
}
