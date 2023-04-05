<script setup lang="ts">
import "@picocss/pico/css/pico.min.css";

const ingestEndpoint = $ref("");
const stageToken = $ref("");
const streamKey = $ref<string>();
const nowPlaying = $ref(false);
</script>

<template>
  <header class="container" style="padding-top: 3.5em">
    <hgroup>
      <h1>Amazon IVS Multi-host for Web demo</h1>
      <h2>A website where you can try out the Amazon IVS Multi-host demo.</h2>
    </hgroup>
  </header>
  <main class="container">
    <section>
      <broadcast
        v-if="nowPlaying"
        :ingest-endpoint="ingestEndpoint"
        :stage-token="stageToken"
        :stream-key="streamKey"
      ></broadcast>
    </section>
    <article>
      <form @submit.prevent="nowPlaying = true">
        <div class="grid">
          <label for="ingestEndpoint">
            Ingest endpoint
            <input
              v-model="ingestEndpoint"
              type="text"
              name="ingestEndpoint"
              placeholder="xxxxxxxxxx.global-contribute.live-video.net"
              :readonly="nowPlaying"
            />
          </label>
          <label for="stageToken">
            Stage token
            <input
              v-model="stageToken"
              type="text"
              name="stageToken"
              placeholder="xxxx.xxxxxxxxx.xxxx"
              :readonly="nowPlaying"
            />
          </label>
        </div>
        <label for="streamKey">
          (Optional) Stream key
          <input
            v-model="streamKey"
            type="text"
            name="streamKey"
            placeholder="sk_us-east-1_xxxxxxx"
            :readonly="nowPlaying"
          />
          <small>Only hosts in broadcast specify the stream key.</small>
        </label>
        <button
          type="submit"
          :disabled="nowPlaying || !ingestEndpoint || !stageToken"
        >
          start
        </button>
      </form>
    </article>
  </main>
</template>
