<script setup lang="ts">
import { computed, ref } from 'vue'

type DraggableItem = any

const props = defineProps<{
  modelValue: DraggableItem[]
  itemKey: string
  handleSelector?: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: DraggableItem[]): void
  (event: 'change', value: DraggableItem[]): void
  (event: 'end', value: DraggableItem[]): void
}>()

const items = computed(() => props.modelValue)
const draggingIndex = ref<number | null>(null)
const hoverIndex = ref<number | null>(null)
let dropCommitted = false

function extractKey(item: DraggableItem, index: number): PropertyKey {
  const record = (item ?? {}) as Record<string, unknown>
  const key = record[props.itemKey]

  if (key === undefined || key === null) {
    return index
  }

  if (typeof key === 'string' || typeof key === 'number' || typeof key === 'symbol') {
    return key
  }

  return index
}

function isHandleValid(event: DragEvent, wrapper: HTMLElement) {
  if (!props.handleSelector) {
    return true
  }

  const target = event.target as HTMLElement | null
  if (!target) {
    return false
  }

  const handle = target.closest(props.handleSelector)
  return !!handle && wrapper.contains(handle)
}

function reorder(from: number, to: number) {
  const next = items.value.slice()
  const [moved] = next.splice(from, 1)
  if (moved === undefined) {
    return
  }
  next.splice(to, 0, moved)
  dropCommitted = true
  emit('update:modelValue', next)
  emit('change', next)
  emit('end', next)
}

function onDragStart(index: number, event: DragEvent) {
  const wrapper = event.currentTarget as HTMLElement | null
  if (!event.dataTransfer || !wrapper) {
    return
  }

  if (!isHandleValid(event, wrapper)) {
    event.preventDefault()
    return
  }

  dropCommitted = false
  draggingIndex.value = index
  hoverIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(index))
  wrapper.classList.add('reorderable-grid__item--drag-origin')
}

function onDragEnter(index: number) {
  if (draggingIndex.value === null || index === draggingIndex.value) {
    return
  }

  hoverIndex.value = index
}

function onDragOver(index: number, event: DragEvent) {
  if (draggingIndex.value === null) {
    return
  }

  event.preventDefault()
  event.dataTransfer && (event.dataTransfer.dropEffect = 'move')
  hoverIndex.value = index
}

function onDrop(index: number, event: DragEvent) {
  event.preventDefault()
  if (draggingIndex.value === null) {
    return
  }

  const from = draggingIndex.value
  if (from !== index) {
    reorder(from, index)
  }

  draggingIndex.value = index
  hoverIndex.value = null
}

function onContainerDrop(event: DragEvent) {
  event.preventDefault()
  if (draggingIndex.value === null) {
    return
  }

  const from = draggingIndex.value
  if (items.value.length === 0) {
    return
  }
  const lastIndex = items.value.length - 1
  reorder(from, lastIndex)
  draggingIndex.value = lastIndex
  hoverIndex.value = null
}

function onDragEnd(event: DragEvent) {
  const wrapper = event.currentTarget as HTMLElement | null
  wrapper?.classList.remove('reorderable-grid__item--drag-origin')

  if (!dropCommitted && draggingIndex.value !== null) {
    emit('end', items.value.slice())
  }

  dropCommitted = false
  draggingIndex.value = null
  hoverIndex.value = null
}
</script>

<template>
  <div class="reorderable-grid">
    <div
      v-for="(item, index) in items"
      :key="extractKey(item, index)"
      class="reorderable-grid__item"
      :class="{
        'reorderable-grid__item--dragging': index === draggingIndex,
        'reorderable-grid__item--hovered': hoverIndex === index && draggingIndex !== index,
      }"
      draggable="true"
      @dragstart="onDragStart(index, $event)"
      @dragenter.prevent="onDragEnter(index)"
      @dragover.prevent="onDragOver(index, $event)"
      @drop.prevent="onDrop(index, $event)"
      @dragend="onDragEnd"
    >
      <slot name="item" :element="item" :index="index" />
    </div>
    <div class="reorderable-grid__spacer" @dragover.prevent @drop.prevent="onContainerDrop"></div>
  </div>
</template>

<style scoped>
.reorderable-grid {
  display: grid;
  grid-template-columns: inherit;
  gap: inherit;
}

.reorderable-grid__item--dragging {
  opacity: 0.5;
}

.reorderable-grid__item--hovered {
  outline: 2px dashed var(--border);
  outline-offset: 4px;
}

.reorderable-grid__item--drag-origin {
  opacity: 0.7;
}

.reorderable-grid__spacer {
  width: 100%;
  height: 1px;
}
</style>
