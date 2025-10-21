<script setup lang="ts">
const props = defineProps<{
  protocol: 'rtmp' | 'srt' | 'ts'
  isStreaming: boolean
  errorMessage?: string | null
}>()
</script>

<template>
  <section class="preview-panel" role="group" aria-labelledby="preview-heading">
    <header class="preview-header">
      <h2 id="preview-heading">Stream preview</h2>
      <span class="protocol" :class="{ active: props.isStreaming }">
        {{ props.protocol.toUpperCase() }}
      </span>
    </header>

    <div class="preview-content">
      <slot>
        <div class="placeholder" aria-hidden="true">
          <span class="placeholder-text">
            {{ props.isStreaming ? 'No preview available' : 'Stream inactive' }}
          </span>
        </div>
      </slot>
    </div>

    <p v-if="props.errorMessage" class="error-message" role="alert">
      {{ props.errorMessage }}
    </p>
  </section>
</template>

<style scoped>
.preview-panel {
  width: min(100%, 480px);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 1rem;
  background: #ffffff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.protocol {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9ca3af;
  transition: color 0.2s ease, transform 0.2s ease;
}

.protocol.active {
  color: #10b981;
  transform: translateY(-1px);
}

.preview-content {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 0.75rem;
  overflow: hidden;
  background: radial-gradient(circle at top, #1f2937, #111827);
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-content: center;
  color: #d1d5db;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: repeating-linear-gradient(
    45deg,
    rgba(148, 163, 184, 0.18),
    rgba(148, 163, 184, 0.18) 10px,
    rgba(30, 41, 59, 0.18) 10px,
    rgba(30, 41, 59, 0.18) 20px
  );
}

.placeholder-text {
  padding: 0.75rem 1.25rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.45);
  color: #f9fafb;
  font-weight: 600;
}

.error-message {
  margin: 0;
  color: #dc2626;
  font-size: 0.9rem;
}
</style>
