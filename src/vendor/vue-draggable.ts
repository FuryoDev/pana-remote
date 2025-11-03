import { computed, defineComponent, h, ref, type PropType } from 'vue'

type PullMode = boolean | 'clone'

interface GroupConfig {
  name?: string
  pull?: PullMode
  put?: boolean
}

interface DragContext {
  componentId: symbol
  groupName: string
  index: number
  item: unknown
  pullMode: PullMode
  clone: (item: unknown) => unknown
  updateList: (next: unknown[]) => void
  getListSnapshot: () => unknown[]
}

let activeDrag: DragContext | null = null

const defaultClone = (item: unknown) => {
  try {
    return structuredClone(item)
  } catch (error) {
    return JSON.parse(JSON.stringify(item))
  }
}

export default defineComponent({
  name: 'VueDraggable',
  props: {
    list: {
      type: Array,
      required: true,
    },
    itemKey: {
      type: String,
      required: true,
    },
    tag: {
      type: String,
      default: 'div',
    },
    group: {
      type: Object as PropType<GroupConfig>,
      default: () => ({}),
    },
    clone: {
      type: Function as PropType<(item: unknown) => unknown>,
      default: () => defaultClone,
    },
  },
  emits: ['update:list', 'change'],
  setup(props, { slots, emit }) {
    const componentId = Symbol('vue-draggable')
    const hoverIndex = ref<number | null>(null)
    const draggingIndex = ref<number | null>(null)

    const groupName = computed(() => props.group?.name ?? '__default')
    const canPull = computed<PullMode>(() => props.group?.pull ?? true)

    function emitUpdate(next: unknown[], meta: { from: number; to: number }) {
      emit('update:list', next)
      emit('change', { list: next, ...meta })
    }

    function resetState() {
      hoverIndex.value = null
      draggingIndex.value = null
      if (activeDrag?.componentId === componentId) {
        activeDrag = null
      }
    }

    function handleDragStart(event: DragEvent, index: number) {
      if (canPull.value === false) {
        event.preventDefault()
        return
      }
      const item = props.list[index]
      if (!item) {
        return
      }
      draggingIndex.value = index
      event.dataTransfer?.setData('text/plain', '')
      activeDrag = {
        componentId,
        groupName: groupName.value,
        index,
        item,
        pullMode: canPull.value,
        clone: props.clone,
        getListSnapshot: () => props.list.slice(),
        updateList: (next) => emitUpdate(next, { from: index, to: index }),
      }
    }

    function handleDragEnd() {
      resetState()
      if (activeDrag?.componentId === componentId) {
        activeDrag = null
      }
    }

    function handleDragEnter(event: DragEvent, index: number) {
      event.preventDefault()
      hoverIndex.value = index
    }

    function performDrop(targetIndex: number) {
      const context = activeDrag
      if (!context) {
        return
      }

      if (context.groupName !== groupName.value) {
        return
      }

      const putAllowed = props.group?.put !== false
      if (!putAllowed && context.componentId !== componentId) {
        return
      }

      const currentList = props.list.slice()

      if (context.componentId === componentId) {
        const [moved] = currentList.splice(context.index, 1)
        let insertionIndex = targetIndex
        if (context.index < targetIndex) {
          insertionIndex -= 1
        }
        if (insertionIndex < 0) {
          insertionIndex = 0
        }
        if (insertionIndex > currentList.length) {
          insertionIndex = currentList.length
        }
        currentList.splice(insertionIndex, 0, moved)
        emitUpdate(currentList, { from: context.index, to: insertionIndex })
        activeDrag = { ...context, index: insertionIndex, updateList: context.updateList }
      } else {
        let itemToInsert: unknown
        if (context.pullMode === 'clone') {
          itemToInsert = context.clone(context.item)
        } else {
          const sourceList = context.getListSnapshot()
          const [removed] = sourceList.splice(context.index, 1)
          context.updateList(sourceList)
          itemToInsert = removed
        }

        if (!putAllowed) {
          return
        }

        const insertionIndex = Math.max(0, Math.min(targetIndex, currentList.length))
        currentList.splice(insertionIndex, 0, itemToInsert)
        emitUpdate(currentList, { from: context.index, to: insertionIndex })
      }

      resetState()
      activeDrag = null
    }

    function handleItemDrop(event: DragEvent, index: number) {
      event.preventDefault()
      performDrop(index)
    }

    function handleContainerDrop(event: DragEvent) {
      event.preventDefault()
      performDrop(props.list.length)
    }

    return () => {
      const children = props.list.map((element: any, index: number) => {
        const key = element?.[props.itemKey] ?? index
        const slotProps = { element, index }
        const content = slots.default ? slots.default(slotProps) : []

        return h(
          'div',
          {
            key,
            class: [
              'vue-draggable__item',
              { 'vue-draggable__item--hover': hoverIndex.value === index, 'vue-draggable__item--dragging': draggingIndex.value === index },
            ],
            draggable: canPull.value !== false,
            onDragstart: (event: DragEvent) => handleDragStart(event, index),
            onDragend: handleDragEnd,
            onDragenter: (event: DragEvent) => handleDragEnter(event, index),
            onDragover: (event: DragEvent) => event.preventDefault(),
            onDrop: (event: DragEvent) => handleItemDrop(event, index),
          },
          content,
        )
      })

      return h(
        props.tag,
        {
          class: 'vue-draggable',
          onDragover: (event: DragEvent) => event.preventDefault(),
          onDrop: handleContainerDrop,
        },
        children,
      )
    }
  },
})

export type { GroupConfig }
