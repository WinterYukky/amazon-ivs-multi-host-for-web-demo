<script setup lang="ts">
import IVSBroadcastClient, {
  LocalStageStream,
  Stage,
  StageEvents,
  StageParticipantInfo,
  StageStream,
  StreamType,
  SubscribeType,
} from "amazon-ivs-web-broadcast";

const props = defineProps<{
  ingestEndpoint: string;
  stageToken: string;
  streamKey?: string;
}>();

const client = IVSBroadcastClient.create({
  // Enter the desired stream configuration
  streamConfig: IVSBroadcastClient.BASIC_LANDSCAPE,
  // Enter the ingest endpoint from the AWS console or CreateChannel API
  ingestEndpoint: props.ingestEndpoint,
});

const streamConfig = IVSBroadcastClient.BASIC_LANDSCAPE;

const canvas = $ref<HTMLCanvasElement>();
let participants = $ref<StageParticipantInfo[]>([]);
const videos = $ref<HTMLVideoElement[]>([]);

onMounted(async () => {
  await usePermissions();

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter((d) => d.kind === "videoinput");
  const audioDevices = devices.filter((d) => d.kind === "audioinput");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: audioDevices[0].deviceId },
    video: { deviceId: videoDevices[0].deviceId },
  });
  const audioTrack = new LocalStageStream(stream.getAudioTracks()[0]);
  const videoTrack = new LocalStageStream(stream.getVideoTracks()[0]);

  const stage = new Stage(props.stageToken, {
    stageStreamsToPublish() {
      return [audioTrack, videoTrack];
    },
    shouldPublishParticipant(participant) {
      return true;
    },
    shouldSubscribeToParticipant(participant) {
      return SubscribeType.AUDIO_VIDEO;
    },
  });
  client.enableVideo();
  client.enableAudio();
  client.attachPreview(canvas!);
  if (props.streamKey) {
    client.startBroadcast(props.streamKey);
  }

  const refreshVideoPositions = () =>
    participants.forEach((participant, index) =>
      client.updateVideoDeviceComposition(`video-${participant.id}`, {
        index: 0,
        width: streamConfig.maxResolution.width / participants.length,
        x: index * (streamConfig.maxResolution.width / participants.length),
      })
    );

  stage.on(
    StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED,
    async (participant: StageParticipantInfo, streams: StageStream[]) => {
      console.log("STAGE_PARTICIPANT_STREAMS_ADDED", participant);

      // add participants to broadcast
      participants = Array.from(new Set([...participants, participant]));

      // wait render video elements that is created by vue
      await nextTick();
      const video = videos.find(
        (v) => v.dataset.participantId === participant.id
      );
      if (!video) return;

      // Attach the participants streams
      const streamsToDisplay = participant.isLocal
        ? streams.filter((stream) => stream.streamType === StreamType.VIDEO)
        : streams;
      video.srcObject = new MediaStream(
        streamsToDisplay.map((stream) => stream.mediaStreamTrack)
      );
      // require to call before addVideoInputDevice
      await video.play();
      await Promise.all([
        ...streams
          .filter((stream) => stream.streamType === StreamType.VIDEO)
          .map((stream) =>
            client.addVideoInputDevice(
              new MediaStream([stream.mediaStreamTrack]),
              `video-${participant.id}`,
              {
                index: 0,
                width: streamConfig.maxResolution.width / participants.length,
                x:
                  (participants.length - 1) *
                  (streamConfig.maxResolution.width / participants.length),
              }
            )
          ),
        ...streams
          .filter((stream) => stream.streamType === StreamType.AUDIO)
          .map((stream) =>
            client.addAudioInputDevice(
              new MediaStream([stream.mediaStreamTrack]),
              `audio-${participant.id}`
            )
          ),
      ]);
      refreshVideoPositions();
    }
  );
  stage.on(
    StageEvents.STAGE_PARTICIPANT_STREAMS_REMOVED,
    async (participant: StageParticipantInfo) => {
      console.log("STAGE_PARTICIPANT_STREAMS_REMOVED", participant);

      // remove participant from broadcast
      participants = participants.filter(
        (exist) => exist.id !== participant.id
      );
      client.removeVideoInputDevice(`video-${participant.id}`);
      client.removeAudioInputDevice(`audio-${participant.id}`);
      refreshVideoPositions();
    }
  );

  stage.on(
    StageEvents.STAGE_PARTICIPANT_JOINED,
    async (participant: StageParticipantInfo) => {
      console.log("STAGE_PARTICIPANT_JOINED", participant);
    }
  );
  stage.on(
    StageEvents.STAGE_PARTICIPANT_LEFT,
    async (_participant: StageParticipantInfo) => {
      console.log("STAGE_PARTICIPANT_LEFT", participants);
    }
  );
  await stage.join();
});
</script>

<template>
  <div>
    <canvas ref="canvas" style="width: 100%"></canvas>
    <video
      v-for="participant in participants"
      :data-participant-id="participant.id"
      ref="videos"
      hidden
      playsinline
      autoplay
      muted
      control
    ></video>
  </div>
</template>
